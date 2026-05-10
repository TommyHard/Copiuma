import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Player } from '@/features/player/Player';
import { ToastContainer } from '@/features/notifications/ToastContainer';
import { useNotificationHub } from '@/features/notifications/useNotificationHub';
import { useUserStateSync } from '@/features/sync/useUserStateSync';
import { OfflineBanner } from '@/features/offline/OfflineBanner';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { ResizeHandle } from './ResizeHandle';
import { useUIStore } from '@/shared/store/uiStore';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import { AlertDialog } from '@/shared/ui/AlertDialog';
import { LyricsView } from '@/features/lyrics/LyricsView';

export function AppLayout() {
    useNotificationHub();
    useUserStateSync();

    const {
        isLeftOpen, setLeftOpen, leftWidth, setLeftWidth,
        isRightOpen, setRightOpen, rightWidth, setRightWidth,
        setIsResizingLeft, setIsResizingRight,
        isLyricsOpen,
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
                    <ScrollArea.Root className="flex-1 overflow-hidden">
                        <ScrollArea.Viewport
                            id="main-scroll-container"
                            className="w-full h-full [&>div]:!block"
                        >
                            <Outlet />
                        </ScrollArea.Viewport>

                        <ScrollArea.Scrollbar
                            className="flex select-none touch-none p-0.5 bg-transparent transition-colors hover:bg-fg-muted/10 w-2.5 z-50"
                            orientation="vertical"
                        >
                            <ScrollArea.Thumb className="flex-1 bg-border rounded-md relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
                        </ScrollArea.Scrollbar>
                    </ScrollArea.Root>

                    {/* Lyrics поверх центральной секции */}
                    {isLyricsOpen && <LyricsView />}
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
            <AlertDialog />
            <div className="z-50 w-full shrink-0">
                <Player />
            </div>
        </div>
    );
}