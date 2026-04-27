import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Player } from '@/features/player/Player';
import { ToastContainer } from '@/features/notifications/ToastContainer';
import { useNotificationHub } from '@/features/notifications/useNotificationHub';

export function AppLayout() {
    useNotificationHub();

    return (
        <div className="flex min-h-screen flex-col bg-bg">
            <Header />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
                <Outlet />
            </main>
            <ToastContainer />
            <div className="sticky bottom-0">
                <Player />
            </div>
        </div>
    );
}