import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Полоска сверху: показывается, если приложение либо
 *   а) не может достучаться до сервера и работает на cached-снимке "me",
 *   б) браузер сообщает navigator.onLine === false
 *
 * Скрывается на самой /offline странице, чтобы не дублировать контекст
 */
export function OfflineBanner() {
    const { isOffline } = useAuth();
    const loc = useLocation();
    const [navigatorOffline, setNavigatorOffline] = useState(
        typeof navigator !== 'undefined' && navigator.onLine === false,
    );

    useEffect(() => {
        function on() { setNavigatorOffline(false); }
        function off() { setNavigatorOffline(true); }
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
    }, []);

    const show = isOffline || navigatorOffline;
    if (!show) return null;
    if (loc.pathname.startsWith('/offline')) return null;

    return (
        <div className="border-b border-purple-500/40 bg-purple-500/10 px-4 py-2 text-center text-xs text-black-200">
            Сервер недоступен — работаем в офлайн-режиме.{' '}
            <Link to="/offline" className="font-medium underline hover:text-red-100">
                Перейти к скачанным трекам
            </Link>
        </div>
    );
}