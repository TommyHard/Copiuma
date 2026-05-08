import { useCallback } from 'react';
import { getTrackStatus } from '@/shared/api/catalog';
import { isTrackCachedOffline } from '@/features/offline/offlineCache';
import { usePlayer, type PlayerTrack } from './store';
import { useAlertStore } from '@/shared/store/alertStore';

function isNetworkError(err: unknown): boolean {
    const e = err as any;
    if (!e) return false;
    if (e.response) return false;
    if (e.code === 'ERR_NETWORK' || e.code === 'ECONNABORTED' || e.code === 'ERR_CANCELED') return true;
    if (typeof e.message === 'string' && /network|fetch|failed/i.test(e.message)) return true;
    return !!e.request || !e.response;
}

export function usePlayTrack() {
    const playTrack = usePlayer((s) => s.playTrack);
    const showAlert = useAlertStore((s) => s.showAlert);

    return useCallback(
        async (track: Omit<PlayerTrack, 'hlsReady'>) => {
            try {
                const st = await getTrackStatus(track.id);
                if (st.status !== 'Ready') {
                    showAlert(
                        `Трек ещё обрабатывается (status=${st.status}). Попробуй позже.`,
                        'Трек недоступен'
                    );
                    return;
                }
                playTrack({ ...track, hlsReady: true });
            } catch (err) {
                const cached = await isTrackCachedOffline(track.id).catch(() => false);
                if (cached) {
                    playTrack({ ...track, hlsReady: true });
                    return;
                }
                if (isNetworkError(err)) {
                    showAlert('Нет сети, и этот трек не скачан в офлайн.', 'Ошибка сети');
                } else {
                    showAlert('Не получилось получить статус трека.', 'Ошибка воспроизведения');
                }
            }
        },
        [playTrack, showAlert],
    );
}