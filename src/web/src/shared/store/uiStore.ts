import { create } from 'zustand';

interface UIState {
    isRightOpen: boolean;
    rightTab: 'queue' | 'friends';
    setRightOpen: (open: boolean) => void;
    setRightTab: (tab: 'queue' | 'friends') => void;
}

export const useUIStore = create<UIState>((set) => ({
    isRightOpen: true,
    rightTab: 'queue',
    setRightOpen: (o) => set({ isRightOpen: o }),
    setRightTab: (tab) => set({ rightTab: tab, isRightOpen: true }),
}));