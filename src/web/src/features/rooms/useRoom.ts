import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { tokenStore } from '@/shared/lib/tokenStore';
import { useRoomStore } from './roomStore';
import { usePlayer } from '@/features/player/store';

/**
 * ѕоднимает SignalR-коннект под конкретную комнату
 *
 *   - Listener: получает SyncCurrentTrack/ReceivePlay/ReceivePause/ReceiveSeek/ReceiveHeartbeat
 *     и переписывает локальный player-store. Ћокальный togglePlay/seek/next игноритс€ в UI
 *
 *   - DJ: при изменении состо€ни€ player локально (play/pause/seek) шлЄт SendPlay/Pause/Seek
 *      аждые 5 секунд Ч heartbeat, чтобы новые joiner получали актуальный SyncCurrentTrack
 */
export function useRoom(roomId: string, requestDj: boolean) {
    const conn = useRef<signalR.HubConnection | null>(null);
    const heartbeat = useRef<number | null>(null);
    const lastSentRef = useRef<{ playing: boolean; pos: number }>({ playing: false, pos: 0 });

    const upsertParticipant = useRoomStore((s) => s.upsertParticipant);
    const removeParticipant = useRoomStore((s) => s.removeParticipant);
    const setRoomState = useRoomStore((s) => s.set);
    const resetRoom = useRoomStore((s) => s.reset);

    useEffect(() => {
        const base = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
        const url = `${base}/notifications-hub`;

        setRoomState({ roomId, isDj: false, djName: null, participants: [], current: null, rejected: null });

        const c = new signalR.HubConnectionBuilder()
            .withUrl(url, { accessTokenFactory: () => tokenStore.getAccess() ?? '' })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // listeners (server -> client)

        c.on('RoomJoined', (isDj: boolean) => {
            setRoomState({ isDj });
        });

        c.on('DjRejected', (currentDjName: string | null) => {
            setRoomState({ rejected: currentDjName ?? 'кто-то другой', isDj: false });
        });

        c.on(
            'SyncCurrentTrack',
            (trackId: string, title: string, artist: string | null, position: number, isPlaying: boolean) => {
                setRoomState({
                    current: { trackId, title, artist, position, isPlaying },
                });
                applyToPlayer({ trackId, title, artist, position, isPlaying });
            },
        );

        c.on('ParticipantJoined', (raw: any) => {
            upsertParticipant({
                userId: raw.userId ?? raw.UserId,
                userName: raw.userName ?? raw.UserName ?? 'unknown',
                isDj: raw.isDj ?? raw.IsDj ?? false,
            });
        });

        c.on('ParticipantLeft', (raw: any) => {
            removeParticipant(raw.userId ?? raw.UserId);
        });

        c.on(
            'ReceivePlay',
            (trackId: string, title: string, artist: string | null, position: number) => {
                setRoomState({
                    current: { trackId, title, artist, position, isPlaying: true },
                });
                applyToPlayer({ trackId, title, artist, position, isPlaying: true });
            },
        );

        c.on('ReceivePause', (position: number) => {
            setRoomState((current => ({ current: current.current ? { ...current.current, position, isPlaying: false } : null }))(useRoomStore.getState()));
            // Ћокальный плеер Ч на паузу
            usePlayer.setState({ isPlaying: false });
            usePlayer.getState().seek(position);
        });

        c.on('ReceiveSeek', (position: number) => {
            setRoomState((current => ({ current: current.current ? { ...current.current, position } : null }))(useRoomStore.getState()));
            usePlayer.getState().seek(position);
        });

        c.on('ReceiveHeartbeat', (position: number, isPlaying: boolean) => {
            setRoomState((current => ({ current: current.current ? { ...current.current, position, isPlaying } : null }))(useRoomStore.getState()));
            // подт€гивание позиции
            if (Math.abs(usePlayer.getState().position - position) > 1.5) {
                usePlayer.getState().seek(position);
            }
            usePlayer.setState({ isPlaying });
        });

        // start
        c.start()
            .then(() => c.invoke('JoinRoom', roomId, requestDj))
            .then(() => {
                conn.current = c;
            })
            .catch((err) => {
                console.warn('[room] connect failed', err);
            });

        return () => {
            conn.current = null;
            if (heartbeat.current) {
                window.clearInterval(heartbeat.current);
                heartbeat.current = null;
            }
            void c.invoke('LeaveRoom').catch(() => { });
            void c.stop().catch(() => { });
            resetRoom();
        };
    }, [roomId, requestDj]);

    // DJ -> server: на каждый локальный play/pause/seek шлЄм событие
    useEffect(() => {
        if (!conn.current) return;

        const unsub = usePlayer.subscribe((s, prev) => {
            if (!useRoomStore.getState().isDj) return;
            if (!conn.current) return;

            const t = s.queue[s.index];
            if (!t) return;

            // сменили трек
            if (t.id !== prev.queue[prev.index]?.id) {
                void conn.current.invoke('SendPlay', useRoomStore.getState().roomId, t.id, t.title, t.artist ?? '', s.position).catch(() => { });
                lastSentRef.current = { playing: s.isPlaying, pos: s.position };
                return;
            }

            // play/pause toggle
            if (s.isPlaying !== prev.isPlaying) {
                if (s.isPlaying) {
                    void conn.current.invoke('SendPlay', useRoomStore.getState().roomId, t.id, t.title, t.artist ?? '', s.position).catch(() => { });
                } else {
                    void conn.current.invoke('SendPause', useRoomStore.getState().roomId, s.position).catch(() => { });
                }
                lastSentRef.current = { playing: s.isPlaying, pos: s.position };
                return;
            }

            // seek (заметна€ разница позиции)
            if (Math.abs(s.position - prev.position) > 2) {
                void conn.current.invoke('SendSeek', useRoomStore.getState().roomId, s.position).catch(() => { });
                lastSentRef.current = { playing: s.isPlaying, pos: s.position };
            }
        });

        // heartbeat каждые 5 секунд
        heartbeat.current = window.setInterval(() => {
            if (!useRoomStore.getState().isDj || !conn.current) return;
            const s = usePlayer.getState();
            void conn.current.invoke('SendHeartbeat', useRoomStore.getState().roomId, s.position, s.isPlaying).catch(() => { });
        }, 5000);

        return () => {
            unsub();
            if (heartbeat.current) {
                window.clearInterval(heartbeat.current);
                heartbeat.current = null;
            }
        };
    }, []);
}

function applyToPlayer(t: { trackId: string; title: string; artist: string | null; position: number; isPlaying: boolean }) {
    const player = usePlayer.getState();
    const playing = player.queue[player.index];
    if (!playing || playing.id !== t.trackId) {
        player.playTrack({
            id: t.trackId,
            title: t.title,
            artist: t.artist,
            duration: null,
            uploadedAt: '',
            artistId: null,
            albumId: null,
            trackNumber: null,
            isExplicit: false,
            hlsReady: true,
        });
    }
    if (t.position) player.seek(t.position);
    usePlayer.setState({ isPlaying: t.isPlaying });
}