import { api } from './http';
import type { NotificationItem } from '@/shared/types';

export async function listNotifications(page = 1, pageSize = 30): Promise<NotificationItem[]> {
    const r = await api.get<NotificationItem[]>('/notifications', { params: { page, pageSize } });
    return r.data;
}

export async function unreadCount(): Promise<number> {
    const r = await api.get<{ count: number } | number>('/notifications/unread-count');
    return typeof r.data === 'number' ? r.data : r.data.count;
}

export async function markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
}

export async function markAllRead(): Promise<void> {
    await api.post('/notifications/read-all');
}