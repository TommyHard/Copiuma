import { create } from 'zustand';

interface UIState {
    isLeftOpen: boolean;
    leftWidth: number;
    isRightOpen: boolean;
    rightWidth: number;
    rightTab: 'queue' | 'friends' | 'now-playing';

    isResizingLeft: boolean;
    isResizingRight: boolean;

    setLeftOpen: (open: boolean) => void;
    setLeftWidth: (width: number) => void;
    setRightOpen: (open: boolean) => void;
    setRightWidth: (width: number) => void;
    setRightTab: (tab: 'queue' | 'friends' | 'now-playing') => void;

    setIsResizingLeft: (b: boolean) => void;
    setIsResizingRight: (b: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    isLeftOpen: true,
    leftWidth: 250,
    isRightOpen: true,
    rightWidth: 280,
    rightTab: 'now-playing',

    setLeftOpen: (o) => set({ isLeftOpen: o }),
    setLeftWidth: (w) => set({ leftWidth: w }),
    setRightOpen: (o) => set({ isRightOpen: o }),
    setRightWidth: (w) => set({ rightWidth: w }),
    setRightTab: (tab) => set({ rightTab: tab, isRightOpen: true }),

    isResizingLeft: false,
    isResizingRight: false,
    setIsResizingLeft: (b) => set({ isResizingLeft: b }),
    setIsResizingRight: (b) => set({ isResizingRight: b }),
}));