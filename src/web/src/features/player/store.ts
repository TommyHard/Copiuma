import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TrackListItem } from '@/shared/types';

export interface PlayerTrack extends TrackListItem {
    hlsReady?: boolean;
}

/**
 * Откуда сейчас играет очередь.
 * type: 'track'      — одиночный трек (нет источника)
 *       'favorites'  — из "Избранного"
 *       'playlist'   — из плейлиста (id обязателен)
 *       'album'      — из альбома (id обязателен)
 *       'artist'     — из страницы артиста (id обязателен)
 *       'queue'      — пользователь вручную вызвал произвольную очередь
 *       'history'    — из истории
 *       'feed'       — из ленты подписок
 *       'for-you'    — из рекомендаций
 *       'popular'    — из популярного
 *       'search'     — из поиска
 *       'offline'    — из офлайн-библиотеки
 *
 * Если context отсутствует — играет одиночный трек без привязки к коллекции
 */
export type PlaybackContext =
    | { type: 'track' }
    | { type: 'favorites' }
    | { type: 'playlist'; id: string }
    | { type: 'album'; id: string }
    | { type: 'artist'; id: string }
    | { type: 'queue' }
    | { type: 'history' }
    | { type: 'feed' }
    | { type: 'for-you' }
    | { type: 'popular' }
    | { type: 'search' }
    | { type: 'offline' };

export type RepeatMode = 'off' | 'all' | 'one';

export type SleepMode = 'after-track' | 'after-queue' | 'timer';
export interface SleepTimerState {
    mode: SleepMode;
    deadlineMs: number | null;
}

export interface EqualizerBand {
    /** Частота в Hz */
    freq: number;
    /** Текущее усиление в dB */
    gain: number;
}
export interface EqualizerState {
    enabled: boolean;

    bands: EqualizerBand[];
    preamp: number; // dB
}

export const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [6, 5, 3, 1, 0, 0, 0, 0, 0, 0],
    vocal: [-2, -1, 0, 2, 4, 4, 2, 1, 0, 0],
    treble: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6],
    rock: [4, 3, 2, 0, -1, 0, 2, 3, 4, 4],
    pop: [-1, 0, 0, 2, 3, 3, 2, 1, 0, -1],
    jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
};

function defaultBands(): EqualizerBand[] {
    return EQ_FREQUENCIES.map((freq) => ({ freq, gain: 0 }));
}

function buildShuffleOrder(length: number, fixedFirst: number): number[] {
    if (length <= 0) return [];
    const rest: number[] = [];
    for (let i = 0; i < length; i++) if (i !== fixedFirst) rest.push(i);

    for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return [fixedFirst, ...rest];
}

export interface PlayerState {
    // queue
    queue: PlayerTrack[];
    index: number;

    // источник очереди — где трек/плейлист сейчас играет
    context: PlaybackContext | null;

    // playback
    isPlaying: boolean;
    position: number;          // секунды
    duration: number;          // секунды
    volume: number;
    muted: boolean;

    // shuffle/repeat
    isShuffle: boolean;

    /** Порядок воспроизведения при shuffle: массив индексов из queue. */
    shuffleOrder: number[];
    repeat: RepeatMode;

    // sleep timer
    sleepTimer: SleepTimerState | null;

    // equalizer
    equalizer: EqualizerState;

    seekRequest: { value: number; nonce: number } | null;

    playTrack(track: PlayerTrack, context?: PlaybackContext): void;
    playQueue(tracks: PlayerTrack[], startIndex?: number, context?: PlaybackContext): void;
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

    toggleShuffle(): void;
    setRepeat(mode: RepeatMode): void;
    cycleRepeat(): void;

    setSleepTimer(state: SleepTimerState | null): void;
    cancelSleepTimer(): void;

    setEqualizerEnabled(on: boolean): void;
    setEqualizerBand(index: number, gain: number): void;
    applyEqualizerPreset(preset: keyof typeof EQ_PRESETS): void;
    setEqualizerPreamp(gain: number): void;
}

const STORAGE_KEY = 'cw:player';

/**
 * Состояние плеера сохраняется в localStorage и восстанавливается при перезагрузке
 * Сохраняем: queue, index, position, volume, muted, shuffle/repeat, equalizer, context
 */
export const usePlayer = create<PlayerState>()(
    persist(
        (set, get) => ({
            queue: [],
            index: -1,
            context: null,

            isPlaying: false,
            position: 0,
            duration: 0,
            volume: 1,
            muted: false,

            isShuffle: false,
            shuffleOrder: [],
            repeat: 'off',

            sleepTimer: null,

            equalizer: { enabled: false, bands: defaultBands(), preamp: 0 },

            seekRequest: null,

            playTrack(track, context) {
                set({
                    queue: [track],
                    index: 0,
                    isPlaying: true,
                    position: 0,
                    duration: 0,
                    context: context ?? { type: 'track' },
                    shuffleOrder: get().isShuffle ? [0] : [],
                });
            },

            playQueue(tracks, startIndex = 0, context) {
                if (tracks.length === 0) return;
                const safe = Math.max(0, Math.min(startIndex, tracks.length - 1));
                const shuffleOrder = get().isShuffle ? buildShuffleOrder(tracks.length, safe) : [];
                set({
                    queue: tracks,
                    index: safe,
                    isPlaying: true,
                    position: 0,
                    duration: 0,
                    context: context ?? { type: 'queue' },
                    shuffleOrder,
                });
            },

            togglePlay() {
                if (get().queue.length === 0) return;
                set((s) => ({ isPlaying: !s.isPlaying }));
            },

            next() {
                const { queue, index, repeat, isShuffle, shuffleOrder, sleepTimer } = get();
                if (queue.length === 0) return;

                // Sleep timer: после трека — пауза
                if (sleepTimer?.mode === 'after-track') {
                    set({ isPlaying: false, position: 0, sleepTimer: null });
                    return;
                }

                // Repeat one — позицию сбросит вызывающая сторона
                if (isShuffle && shuffleOrder.length === queue.length) {
                    const cur = shuffleOrder.indexOf(index);
                    if (cur < shuffleOrder.length - 1) {
                        set({ index: shuffleOrder[cur + 1], position: 0, duration: 0, isPlaying: true });
                        return;
                    }
                    // конец shuffled-очереди
                    if (sleepTimer?.mode === 'after-queue') {
                        set({ isPlaying: false, position: 0, sleepTimer: null });
                        return;
                    }
                    if (repeat === 'all') {
                        // перетасуем заново и стартуем с первого
                        const fresh = buildShuffleOrder(queue.length, Math.floor(Math.random() * queue.length));
                        set({ shuffleOrder: fresh, index: fresh[0], position: 0, duration: 0, isPlaying: true });
                        return;
                    }
                    set({ isPlaying: false, position: 0 });
                    return;
                }

                if (index < queue.length - 1) {
                    set({ index: index + 1, position: 0, duration: 0, isPlaying: true });
                    return;
                }

                // конец последовательной очереди
                if (sleepTimer?.mode === 'after-queue') {
                    set({ isPlaying: false, position: 0, sleepTimer: null });
                    return;
                }
                if (repeat === 'all') {
                    set({ index: 0, position: 0, duration: 0, isPlaying: true });
                    return;
                }
                set({ isPlaying: false, position: 0 });
            },

            prev() {
                const { index, position, queue, isShuffle, shuffleOrder } = get();
                if (queue.length === 0) return;

                if (position > 3) {
                    set({ seekRequest: { value: 0, nonce: Date.now() } });
                    return;
                }

                if (isShuffle && shuffleOrder.length === queue.length) {
                    const cur = shuffleOrder.indexOf(index);
                    if (cur > 0) {
                        set({ index: shuffleOrder[cur - 1], position: 0, duration: 0, isPlaying: true });
                        return;
                    }
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
                    else if (idx === s.index) {
                        if (newIndex >= newQueue.length) newIndex = newQueue.length - 1;
                    }
                    let nextShuffle = s.shuffleOrder;
                    if (s.isShuffle && s.shuffleOrder.length > 0) {
                        nextShuffle = s.shuffleOrder
                            .filter((i) => i !== idx)
                            .map((i) => (i > idx ? i - 1 : i));
                    }
                    return {
                        queue: newQueue,
                        index: newIndex,
                        shuffleOrder: nextShuffle,
                    };
                });
            },

            updateTrackState(trackId, partial) {
                set((s) => ({
                    queue: s.queue.map((t) => t.id === trackId ? { ...t, ...partial } : t)
                }));
            },

            setPosition(value) { set({ position: value }); },
            setDuration(value) { set({ duration: value }); },
            seek(value) { set({ seekRequest: { value, nonce: Date.now() } }); },
            setVolume(value) {
                const v = Math.max(0, Math.min(1, value));
                set({ volume: v, muted: v === 0 });
            },
            toggleMute() { set((s) => ({ muted: !s.muted })); },

            toggleShuffle() {
                const { isShuffle, queue, index } = get();
                if (isShuffle) {
                    set({ isShuffle: false, shuffleOrder: [] });
                } else {
                    const order = queue.length > 0 ? buildShuffleOrder(queue.length, Math.max(0, index)) : [];
                    set({ isShuffle: true, shuffleOrder: order });
                }
            },

            setRepeat(mode) { set({ repeat: mode }); },
            cycleRepeat() {
                set((s) => ({
                    repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
                }));
            },

            setSleepTimer(state) { set({ sleepTimer: state }); },
            cancelSleepTimer() { set({ sleepTimer: null }); },

            setEqualizerEnabled(on) {
                set((s) => ({ equalizer: { ...s.equalizer, enabled: on } }));
            },
            setEqualizerBand(index, gain) {
                set((s) => {
                    const bands = s.equalizer.bands.map((b, i) =>
                        i === index ? { ...b, gain: Math.max(-12, Math.min(12, gain)) } : b
                    );
                    return { equalizer: { ...s.equalizer, bands } };
                });
            },
            applyEqualizerPreset(preset) {
                const gains = EQ_PRESETS[preset] ?? EQ_PRESETS.flat;
                set((s) => ({
                    equalizer: {
                        ...s.equalizer,
                        bands: EQ_FREQUENCIES.map((freq, i) => ({ freq, gain: gains[i] ?? 0 })),
                    },
                }));
            },
            setEqualizerPreamp(gain) {
                set((s) => ({
                    equalizer: { ...s.equalizer, preamp: Math.max(-12, Math.min(12, gain)) },
                }));
            },
        }),
        {
            name: STORAGE_KEY,
            version: 2,
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                queue: state.queue,
                index: state.index,
                position: state.position,
                volume: state.volume,
                muted: state.muted,
                isShuffle: state.isShuffle,
                shuffleOrder: state.shuffleOrder,
                repeat: state.repeat,
                equalizer: state.equalizer,
                context: state.context,
            }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                state.isPlaying = false;
                state.duration = 0;
                state.sleepTimer = null;

                const hasValidTrack =
                    state.queue.length > 0 &&
                    state.index >= 0 &&
                    state.index < state.queue.length;

                state.seekRequest =
                    hasValidTrack && state.position > 0
                        ? { value: state.position, nonce: Date.now() }
                        : null;

                if (!state.equalizer || !Array.isArray(state.equalizer.bands)) {
                    state.equalizer = { enabled: false, bands: defaultBands(), preamp: 0 };
                }
            },
        },
    ),
);

export const currentTrackSelector = (s: PlayerState): PlayerTrack | null =>
    s.index >= 0 && s.index < s.queue.length ? s.queue[s.index] : null;

/**
 * Утилита: совпадает ли текущий контекст плеера с указанным
 */
export function isPlayingFromContext(
    state: PlayerState,
    target: PlaybackContext,
): boolean {
    const ctx = state.context;
    if (!ctx) return false;
    if (ctx.type !== target.type) return false;
    if ('id' in ctx && 'id' in target) return ctx.id === target.id;
    return ctx.type === target.type;
}

/**
 * Утилита: совпадает ли источник И сейчас идёт воспроизведение
 */
export function isActivelyPlayingFrom(
    state: PlayerState,
    target: PlaybackContext,
): boolean {
    return state.isPlaying && isPlayingFromContext(state, target);
}
