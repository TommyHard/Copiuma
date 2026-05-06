import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Player } from '@/features/player/Player';
import { ToastContainer } from '@/features/notifications/ToastContainer';
import { useNotificationHub } from '@/features/notifications/useNotificationHub';
import { OfflineBanner } from '@/features/offline/OfflineBanner';

export function AppLayout() {
    useNotificationHub();
    return (
        <div className="flex h-screen flex-col bg-bg overflow-hidden">

            <OfflineBanner />

            <div className="px-3 pt-3 shrink-0">
                <Header />
            </div>

            {/* Мин. отступ X / Y */}
            <main className="mx-auto w-full flex-1 px-3 py-3 flex flex-col min-h-0">
                <Outlet />
            </main>

            <ToastContainer />

            <div className="z-50 w-full shrink-0">
                <Player />
            </div>
        </div>
    );
}