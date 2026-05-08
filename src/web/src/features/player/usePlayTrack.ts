import { useCallback } from 'react';
import { getTrackStatus } from '@/shared/api/catalog';
import { isTrackCachedOffline } from '@/features/offline/offlineCache';
import { usePlayer, type PlayerTrack, type PlaybackContext } from './store';
import { useAlertStore } from '@/shared/store/alertStore';

function isNetworkError(err: unknown): boolean {
    const e = err as any;
    if (!e) return false;
    if (e.response) return false;
    if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.code === 'ERR_CANCELED') return true;
    if (typeof e.message === 'string' && /network|fetch|failed/i.test(e.message)) return true;
    return !!e.request || !e.response;
}

type RawTrack = Omit<PlayerTrack, 'hlsReady'>;

export interface PlayOptions {
    /** Полный список треков, формирующий очередь. Если не указан — играет только этот трек */
    queue?: RawTrack[];
    /** Индекс стартового трека внутри queue. Если не указан — берётся 0 либо позиция данного трека */
    startIndex?: number;
    /** Откуда играем, для подсветки "Сейчас играет отсюда" */
    context?: PlaybackContext;
}

/**
 * Возвращает функцию запуска воспроизведения
 *
 * play(track) — играет одиночный трек.
 * play(track, { queue, context }) — стартует с указанного трека внутри очереди и сохраняет источник
 * play(track, { queue, startIndex, context }) — то же, но с явным индексом
 */
export function usePlayTrack() {
    const playTrack = usePlayer((s) => s.playTrack);
    const playQueue = usePlayer((s) => s.playQueue);
    const showAlert = useAlertStore((s) => s.showAlert);

    return useCallback(
        async (track: RawTrack, opts?: PlayOptions) => {
            try {
                const st = await getTrackStatus(track.id);
                if (st.status !== 'Ready') {
                    showAlert(
                        `Трек ещё обрабатывается (status=${st.status}). Попробуй позже.`,
                        'Трек недоступен'
                    );
                    return;
                }
                startPlayback(track, opts, playTrack, playQueue);
            } catch (err) {
                const cached = await isTrackCachedOffline(track.id).catch(() => false);
                if (cached) {
                    startPlayback(track, opts, playTrack, playQueue);
                    return;
                }
                if (isNetworkError(err)) {
                    showAlert('Нет сети, и этот трек не скачан в офлайн.', 'Ошибка сети');
                } else {
                    showAlert('Не получилось получить статус трека.', 'Ошибка воспроизведения');
                }
            }
        },
        [playTrack, playQueue, showAlert],
    );
}

function startPlayback(
    track: RawTrack,
    opts: PlayOptions | undefined,
    playTrack: (t: PlayerTrack, ctx?: PlaybackContext) => void,
    playQueue: (qs: PlayerTrack[], idx?: number, ctx?: PlaybackContext) => void,
) {
    const ready: PlayerTrack = { ...track, hlsReady: true };

    if (opts?.queue && opts.queue.length > 0) {
        const list = opts.queue.map<PlayerTrack>((t) => ({ ...t, hlsReady: true }));

        let idx = opts.startIndex ?? list.findIndex((t) => t.id === track.id);
        if (idx < 0) idx = 0;

        if (list[idx]?.id !== track.id) {
            list[idx] = ready;
        }
        playQueue(list, idx, opts.context);
        return;
    }

    playTrack(ready, opts?.context);
}
