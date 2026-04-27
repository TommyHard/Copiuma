import { create } from 'zustand';
import type { RoomParticipant } from '@/shared/types';

/**
 * Состояние «текущей комнаты» — живёт пока на странице /rooms/:id
 */

export interface CurrentTrackInRoom {
    trackId: string;
    title: string;
    artist: string | null;
    position: number;     // секунды
    isPlaying: boolean;
}

interface RoomState {
    roomId: string | null;
    isDj: boolean;
    djName: string | null;
    participants: RoomParticipant[];
    current: CurrentTrackInRoom | null;
    rejected: string | null;

    set(partial: Partial<RoomState>): void;
    reset(): void;
    upsertParticipant(p: RoomParticipant): void;
    removeParticipant(userId: string): void;
}

export const useRoomStore = create<RoomState>((set) => ({
    roomId: null,
    isDj: false,
    djName: null,
    participants: [],
    current: null,
    rejected: null,

    set(partial) {
        set(partial);
    },
    reset() {
        set({
            roomId: null,
            isDj: false,
            djName: null,
            participants: [],
            current: null,
            rejected: null,
        });
    },
    upsertParticipant(p) {
        set((s) => {
            const others = s.participants.filter((x) => x.userId !== p.userId);
            return { participants: [...others, p] };
        });
    },
    removeParticipant(userId) {
        set((s) => ({ participants: s.participants.filter((p) => p.userId !== userId) }));
    },
}));