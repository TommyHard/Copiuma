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

export async function deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
}

/**
 * ”далить уведомлени€.
 * readOnly=true Ч только уже прочитанные ("очистить прочитанные")
 * readOnly=false Ч все
 */
export async function deleteAllNotifications(readOnly = false): Promise<number> {
    const r = await api.delete<{ deleted: number }>('/notifications', { params: { readOnly } });
    return r.data?.deleted ?? 0;
}