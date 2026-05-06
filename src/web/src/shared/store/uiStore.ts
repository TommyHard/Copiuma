import { create } from 'zustand';

interface UIState {
    isRightOpen: boolean;
    rightTab: 'queue' | 'friends' | 'now-playing';
    setRightOpen: (open: boolean) => void;
    setRightTab: (tab: 'queue' | 'friends' | 'now-playing') => void;
}

export const useUIStore = create<UIState>((set) => ({
    isRightOpen: true,
    rightTab: 'now-playing',
    setRightOpen: (o) => set({ isRightOpen: o }),
    setRightTab: (tab) => set({ rightTab: tab, isRightOpen: true }),
}));