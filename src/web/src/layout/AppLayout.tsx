import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Player } from '@/features/player/Player';
import { ToastContainer } from '@/features/notifications/ToastContainer';
import { useNotificationHub } from '@/features/notifications/useNotificationHub';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { ResizeHandle } from './ResizeHandle';
import { useUIStore } from '@/shared/store/uiStore';

export function AppLayout() {
    useNotificationHub();

    const {
        isLeftOpen, setLeftOpen, leftWidth, setLeftWidth,
        isRightOpen, setRightOpen, rightWidth, setRightWidth,
        setIsResizingLeft, setIsResizingRight
    } = useUIStore();

    const COLLAPSE_THRESHOLD = 100;
    const MIN_EXPAND_WIDTH = 250;

    const handleLeftWidthChange = (newWidth: number) => {
        if (newWidth < COLLAPSE_THRESHOLD) {
            if (isLeftOpen) setLeftOpen(false);
        } else {
            if (!isLeftOpen) setLeftOpen(true);
            // Максимальная ширина
            const maxWidth = window.innerWidth * 0.2;
            setLeftWidth(Math.min(maxWidth, Math.max(MIN_EXPAND_WIDTH, newWidth)));
        }
    };

    const handleRightWidthChange = (newWidth: number) => {
        if (newWidth < COLLAPSE_THRESHOLD) {
            if (isRightOpen) setRightOpen(false);
        } else {
            if (!isRightOpen) setRightOpen(true);
            // Максимальная ширина
            const maxWidth = window.innerWidth * 0.25;
            setRightWidth(Math.min(maxWidth, Math.max(MIN_EXPAND_WIDTH, newWidth)));
        }
    };

    return (
        <div className="flex h-screen flex-col bg-bg overflow-hidden">
            <OfflineBanner />
            <div className="px-3 pt-3 shrink-0">
                <Header />
            </div>

            <div className="flex h-full w-full overflow-hidden text-sm gap-[3px] px-3 py-3">
                {/* SECTION 1: Left Sidebar */}
                <SidebarLeft />

                {isLeftOpen && (
                    <ResizeHandle
                        width={leftWidth}
                        onWidthChange={handleLeftWidthChange}
                        onResizeStateChange={setIsResizingLeft}
                        direction={1}
                    />
                )}

                {/* SECTION 2: Dynamic Content */}
                <main className="relative flex-1 flex flex-col min-w-[350px] rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden">

                    {/* DYNAMIC PAGE INJECTION */}
                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50">
                        <Outlet />
                    </div>
                </main>

                {isRightOpen && (
                    <ResizeHandle
                        width={rightWidth}
                        onWidthChange={handleRightWidthChange}
                        onResizeStateChange={setIsResizingRight}
                        direction={-1}
                    />
                )}

                {/* SECTION 3: Right Sidebar */}
                <SidebarRight />
            </div>

            <ToastContainer />
            <div className="z-50 w-full shrink-0">
                <Player />
            </div>
        </div>
    );
}