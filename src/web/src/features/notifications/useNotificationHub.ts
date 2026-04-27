import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStore } from '@/shared/lib/tokenStore';
import { useAuth } from '@/features/auth/useAuth';
import type { NotificationItem } from '@/shared/types';
import { useToasts } from './toastStore';

/**
 * Hub-коннект на жизнь приложени€. ѕоднимаетс€ при
 * authenticated, останавливаетс€ при logout
 */
export function useNotificationHub() {
    const { status } = useAuth();
    const qc = useQueryClient();
    const push = useToasts((s) => s.push);
    const conn = useRef<signalR.HubConnection | null>(null);

    useEffect(() => {
        if (status !== 'authenticated') return;

        const base = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
        const url = `${base}/notifications-hub`;

        const c = new signalR.HubConnectionBuilder()
            .withUrl(url, {
                accessTokenFactory: () => tokenStore.getAccess() ?? '',
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        c.on('NotificationReceived', (raw: NotificationItem) => {
            const r = raw as any;
            const n: NotificationItem = {
                id: r.id ?? r.Id,
                type: r.type ?? r.Type,
                title: r.title ?? r.Title ?? '”ведомление',
                message: r.message ?? r.Message ?? null,
                payload: r.payload ?? r.Payload ?? null,
                isRead: r.isRead ?? r.IsRead ?? false,
                createdAt: r.createdAt ?? r.CreatedAt ?? new Date().toISOString(),
            };
            push(n);
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });

            if (n.type === 'TrackProcessed' && n.payload && typeof n.payload === 'object') {
                const trackId = (n.payload as any).trackId ?? (n.payload as any).TrackId;
                if (trackId) {
                    qc.invalidateQueries({ queryKey: ['track', trackId] });
                    qc.invalidateQueries({ queryKey: ['track-status', trackId] });
                }
            }
        });

        c.start()
            .then(() => {
                conn.current = c;
            })
            .catch((err) => {
                console.warn('[notifications-hub] connect failed', err);
            });

        return () => {
            conn.current = null;
            void c.stop().catch(() => { });
        };
    }, [status, qc, push]);
}