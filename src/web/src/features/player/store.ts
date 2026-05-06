import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TrackListItem } from '@/shared/types';

export interface PlayerTrack extends TrackListItem {
    hlsReady?: boolean;
}

export interface PlayerState {
    // queue
    queue: PlayerTrack[];
    index: number;

    // playback
    isPlaying: boolean;
    position: number;          // секунды
    duration: number;          // секунды
    volume: number;
    muted: boolean;

    seekRequest: { value: number; nonce: number } | null;

    playTrack(track: PlayerTrack): void;
    playQueue(tracks: PlayerTrack[], startIndex?: number): void;
    removeFromQueue(index: number): void;
    updateTrackState(trackId: string, partial: Partial<PlayerTrack>): void;
    togglePlay(): void;
    next(): void;
    prev(): void;
    setPosition(value: number): void;
    setDuration(value: number): void;
    seek(value: number): void;
    setVolume(value: number): void;
    toggleMute(): void;
}

const STORAGE_KEY = 'cw:player';

/**
 * Состояние плеера сохраняется в localStorage и восстанавливается при перезагрузке
 * Сохраняем: queue, index, position, volume, muted
 */
export const usePlayer = create<PlayerState>()(
    persist(
        (set, get) => ({
            queue: [],
            index: -1,
            isPlaying: false,
            position: 0,
            duration: 0,
            volume: 1,
            muted: false,
            seekRequest: null,

            playTrack(track) {
                set({ queue: [track], index: 0, isPlaying: true, position: 0, duration: 0 });
            },

            playQueue(tracks, startIndex = 0) {
                if (tracks.length === 0) return;
                const safe = Math.max(0, Math.min(startIndex, tracks.length - 1));
                set({ queue: tracks, index: safe, isPlaying: true, position: 0, duration: 0 });
            },

            togglePlay() {
                if (get().queue.length === 0) return;
                set((s) => ({ isPlaying: !s.isPlaying }));
            },

            next() {
                const { queue, index } = get();
                if (index < queue.length - 1) {
                    set({ index: index + 1, position: 0, duration: 0, isPlaying: true });
                } else {
                    set({ isPlaying: false, position: 0 });
                }
            },

            prev() {
                const { index, position } = get();
                if (position > 3) {
                    set({ seekRequest: { value: 0, nonce: Date.now() } });
                    return;
                }
                if (index > 0) {
                    set({ index: index - 1, position: 0, duration: 0, isPlaying: true });
                } else {
                    set({ seekRequest: { value: 0, nonce: Date.now() } });
                }
            },

            removeFromQueue(idx) {
                set((s) => {
                    const newQueue = [...s.queue];
                    newQueue.splice(idx, 1);
                    let newIndex = s.index;
                    if (idx < s.index) newIndex--;
                    return { queue: newQueue, index: newIndex };
                });
            },
            updateTrackState(trackId, partial) {
                set((s) => ({
                    queue: s.queue.map((t) => t.id === trackId ? { ...t, ...partial } : t)
                }));
            },

            setPosition(value) {
                set({ position: value });
            },
            setDuration(value) {
                set({ duration: value });
            },
            seek(value) {
                set({ seekRequest: { value, nonce: Date.now() } });
            },
            setVolume(value) {
                const v = Math.max(0, Math.min(1, value));
                set({ volume: v, muted: v === 0 });
            },
            toggleMute() {
                set((s) => ({ muted: !s.muted }));
            },
        }),
        {
            name: STORAGE_KEY,
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                queue: state.queue,
                index: state.index,
                position: state.position,
                volume: state.volume,
                muted: state.muted,
            }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                state.isPlaying = false;
                state.duration = 0;

                const hasValidTrack =
                    state.queue.length > 0 &&
                    state.index >= 0 &&
                    state.index < state.queue.length;

                state.seekRequest =
                    hasValidTrack && state.position > 0
                        ? { value: state.position, nonce: Date.now() }
                        : null;
            },
        },
    ),
);

export const currentTrackSelector = (s: PlayerState): PlayerTrack | null =>
    s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;
