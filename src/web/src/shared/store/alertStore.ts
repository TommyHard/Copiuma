import { create } from 'zustand';

interface AlertState {
    isOpen: boolean;
    message: string;
    title: string;
    showAlert: (message: string, title?: string) => void;
    closeAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
    isOpen: false,
    message: '',
    title: 'Внимание',
    showAlert: (message, title = 'Внимание') => set({ isOpen: true, message, title }),
    closeAlert: () => set({ isOpen: false, message: '' }),
}));