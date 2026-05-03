import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { tokenStore } from '@/shared/lib/tokenStore';
import { useRoomStore } from './roomStore';
import { usePlayer } from '@/features/player/store';

/**
 * Подключение к SignalR-комнате совместного прослушивания
 *
 *   - Listener: получает SyncCurrentTrack/ReceivePlay/ReceivePause/ReceiveSeek/ReceiveHeartbeat
 *     и проигрывает синхронно через player-store. Локальные togglePlay/seek/next пользователя
 *     перезаписываются следующим heartbeat DJ
 *
 *   - DJ: при любом изменении player (play/pause/seek/track) шлёт SendPlay/Pause/Seek
 *     плюс SendHeartbeat каждые 1 секунду, чтобы новый joiner получил актуальное состояние
 *     через SyncCurrentTrack
 */
export function useRoom(roomId: string, requestDj: boolean) {
    const conn = useRef<signalR.HubConnection | null>(null);
    const heartbeat = useRef<number | null>(null);

    const upsertParticipant = useRoomStore((s) => s.upsertParticipant);
    const removeParticipant = useRoomStore((s) => s.removeParticipant);
    const setRoomState = useRoomStore((s) => s.set);
    const resetRoom = useRoomStore((s) => s.reset);

    useEffect(() => {
        const base = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
        const url = `${base}/notifications-hub`;

        setRoomState({
            roomId, isDj: false, djName: null, participants: [], current: null, rejected: null,
        });

        const c = new signalR.HubConnectionBuilder()
            .withUrl(url, { accessTokenFactory: () => tokenStore.getAccess() ?? '' })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        let cancelled = false;
        let unsubPlayer: (() => void) | null = null;

        // listeners (server -> client)

        c.on('RoomJoined', (isDj: boolean) => {
            setRoomState({ isDj });
            // Если стали DJ и уже что-то играет в плеере — сразу транслируем
            // (без этого слушатели не получат активного трека до следующей смены)
            if (isDj) {
                const player = usePlayer.getState();
                const t = player.queue[player.index];
                if (t) {
                    void c.invoke(
                        'SendPlay',
                        roomId,
                        t.id,
                        t.title,
                        t.artist ?? '',
                        player.position,
                    ).catch(() => { });
                    if (!player.isPlaying) {
                        void c.invoke('SendPause', roomId, player.position).catch(() => { });
                    }
                    setRoomState({
                        current: {
                            trackId: t.id,
                            title: t.title,
                            artist: t.artist ?? null,
                            position: player.position,
                            isPlaying: player.isPlaying,
                        },
                    });
                }
            }
        });

        c.on('DjRejected', (currentDjName: string | null) => {
            setRoomState({ rejected: currentDjName ?? 'кто-то другой', isDj: false });
        });

        c.on(
            'SyncCurrentTrack',
            (trackId: string, title: string, artist: string | null, position: number, isPlaying: boolean) => {
                setRoomState({ current: { trackId, title, artist, position, isPlaying } });
                applyToPlayer({ trackId, title, artist, position, isPlaying });
            },
        );

        // Полный список участников комнаты, который шлёт сервер при JoinRoom
        c.on('ParticipantList', (raw: any) => {
            const arr = Array.isArray(raw) ? raw : [];
            const list = arr.map((p: any) => ({
                userId: p.userId ?? p.UserId,
                userName: p.userName ?? p.UserName ?? 'unknown',
                isDj: !!(p.isDj ?? p.IsDj),
            })).filter((p) => !!p.userId);
            setRoomState({ participants: list });
        });

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
                setRoomState({ current: { trackId, title, artist, position, isPlaying: true } });
                applyToPlayer({ trackId, title, artist, position, isPlaying: true });
            },
        );

        c.on('ReceivePause', (position: number) => {
            const cur = useRoomStore.getState().current;
            setRoomState({ current: cur ? { ...cur, position, isPlaying: false } : null });
            usePlayer.setState({ isPlaying: false });
            usePlayer.getState().seek(position);
        });

        c.on('ReceiveSeek', (position: number) => {
            const cur = useRoomStore.getState().current;
            setRoomState({ current: cur ? { ...cur, position } : null });
            usePlayer.getState().seek(position);
        });

        c.on('ReceiveHeartbeat', (position: number, isPlaying: boolean) => {
            const cur = useRoomStore.getState().current;
            setRoomState({ current: cur ? { ...cur, position, isPlaying } : null });

            if (Math.abs(usePlayer.getState().position - position) > 0.5) {
                usePlayer.getState().seek(position);
            }
            usePlayer.setState({ isPlaying });
        });

        // SignalR connection lifecycle с защитой от cancel во время negotiation
        const startPromise = c.start()
            .then(() => {
                if (cancelled) {
                    return c.stop().catch(() => { });
                }
                conn.current = c;
                return c.invoke('JoinRoom', roomId, requestDj);
            })
            .then(() => {
                if (cancelled || conn.current !== c) return;

                // DJ -> server: подписываемся на изменения плеера, чтобы транслировать
                // play/pause/seek/смены трека в комнату
                unsubPlayer = usePlayer.subscribe((s, prev) => {
                    if (!useRoomStore.getState().isDj) return;
                    if (conn.current !== c) return;

                    const t = s.queue[s.index];
                    if (!t) return;
                    const prevTrack = prev.queue[prev.index];

                    // Сменили трек
                    if (t.id !== prevTrack?.id) {
                        void c.invoke('SendPlay', roomId, t.id, t.title, t.artist ?? '', s.position).catch(() => { });
                        setRoomState({
                            current: {
                                trackId: t.id,
                                title: t.title,
                                artist: t.artist ?? null,
                                position: s.position,
                                isPlaying: s.isPlaying,
                            },
                        });
                        return;
                    }

                    // play/pause переключение
                    if (s.isPlaying !== prev.isPlaying) {
                        if (s.isPlaying) {
                            void c.invoke('SendPlay', roomId, t.id, t.title, t.artist ?? '', s.position).catch(() => { });
                        } else {
                            void c.invoke('SendPause', roomId, s.position).catch(() => { });
                        }
                        const cur = useRoomStore.getState().current;
                        setRoomState({
                            current: cur
                                ? { ...cur, position: s.position, isPlaying: s.isPlaying }
                                : {
                                    trackId: t.id,
                                    title: t.title,
                                    artist: t.artist ?? null,
                                    position: s.position,
                                    isPlaying: s.isPlaying,
                                },
                        });
                        return;
                    }

                    // seek
                    if (Math.abs(s.position - prev.position) > 2) {
                        void c.invoke('SendSeek', roomId, s.position).catch(() => { });
                        const cur = useRoomStore.getState().current;
                        if (cur) setRoomState({ current: { ...cur, position: s.position } });
                    }
                });

                // heartbeat каждые 1 секунду — listener корректируют рассинхронизацию,
                // плюс поздно зашедшие получают актуальную позицию между Sync
                heartbeat.current = window.setInterval(() => {
                    if (!useRoomStore.getState().isDj || conn.current !== c) return;
                    const s = usePlayer.getState();
                    void c.invoke('SendHeartbeat', roomId, s.position, s.isPlaying).catch(() => { });
                    const cur = useRoomStore.getState().current;
                    if (cur) {
                        setRoomState({ current: { ...cur, position: s.position, isPlaying: s.isPlaying } });
                    } else {
                        const t = s.queue[s.index];
                        if (t) {
                            setRoomState({
                                current: {
                                    trackId: t.id,
                                    title: t.title,
                                    artist: t.artist ?? null,
                                    position: s.position,
                                    isPlaying: s.isPlaying,
                                },
                            });
                        }
                    }
                }, 1000);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.warn('[room] connect failed', err);
                }
            });

        return () => {
            cancelled = true;
            if (heartbeat.current) {
                window.clearInterval(heartbeat.current);
                heartbeat.current = null;
            }
            if (unsubPlayer) {
                unsubPlayer();
                unsubPlayer = null;
            }
            // Дожидаемся завершения negotiation, иначе SignalR падает
            // с "The connection was stopped during negotiation"
            startPromise.finally(() => {
                if (c.state === signalR.HubConnectionState.Connected) {
                    void c.invoke('LeaveRoom').catch(() => { });
                }
                void c.stop().catch(() => { });
            });
            conn.current = null;
            resetRoom();
        };
    }, [roomId, requestDj]);
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