import { useCallback } from 'react';
import { getTrackStatus } from '@/shared/api/catalog';
import { usePlayer, type PlayerTrack } from './store';

export function usePlayTrack() {
  const playTrack = usePlayer((s) => s.playTrack);

  return useCallback(
    async (track: Omit<PlayerTrack, 'hlsReady'>) => {
      try {
        const st = await getTrackStatus(track.id);
        if (st.status !== 'Ready') {
          alert(`Трек ещё обрабатывается (status=${st.status}). Попробуй позже.`);
          return;
        }
        playTrack({ ...track, hlsReady: true });
      } catch {
        alert('Не получилось получить статус трека.');
      }
    },
    [playTrack],
  );
}