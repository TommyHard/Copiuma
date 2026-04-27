import { create } from 'zustand';
import type { NotificationItem } from '@/shared/types';

export interface Toast {
    id: string;
    notification: NotificationItem;
}

interface ToastsState {
    items: Toast[];
    push(n: NotificationItem): void;
    dismiss(id: string): void;
}

export const useToasts = create<ToastsState>((set) => ({
    items: [],
    push(n) {
        const toast: Toast = { id: `${Date.now()}-${Math.random()}`, notification: n };
        set((s) => ({ items: [...s.items, toast] }));
        setTimeout(() => {
            set((s) => ({ items: s.items.filter((t) => t.id !== toast.id) }));
        }, 5000);
    },
    dismiss(id) {
        set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    },
}));