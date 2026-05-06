import { useEffect, useState, ReactNode } from 'react';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';

export function useContextMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const onContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const x = Math.min(e.clientX, window.innerWidth - 220);
        const y = Math.min(e.clientY, window.innerHeight - 150);
        setPosition({ x, y });
        setIsOpen(true);
    };

    const close = () => setIsOpen(false);

    useEffect(() => {
        if (isOpen) {
            const handleClick = () => close();
            const timer = setTimeout(() => {
                document.addEventListener('click', handleClick);
                document.addEventListener('contextmenu', handleClick);
            }, 0);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('click', handleClick);
                document.removeEventListener('contextmenu', handleClick);
            };
        }
    }, [isOpen]);

    return { isOpen, position, onContextMenu, close };
}

export function ContextMenuPortal({
    isOpen,
    position,
    children
}: {
    isOpen: boolean;
    position: { x: number; y: number };
    children: ReactNode;
}) {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed z-[9999] min-w-[200px] bg-bg-elevated border border-border rounded-md shadow-lg p-1 flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{ top: position.y, left: position.x }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    );
}

export function ContextMenuItem({
    children,
    onClick,
    danger,
    icon,
    disabled
}: {
    children: ReactNode;
    onClick?: () => void;
    danger?: boolean;
    icon?: ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full flex items-center gap-2 text-left px-2 py-1.5 text-sm transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed",
                danger ? "text-danger hover:text-danger hover:bg-danger/10" : "text-fg hover:bg-fg/10"
            )}
        >
            {icon && <span className="shrink-0 flex items-center justify-center w-4">{icon}</span>}
            <span className="truncate">{children}</span>
        </button>
    );
}

export function ContextMenuSeparator() {
    return <div className="h-px bg-border my-1 mx-1" />;
}

export function ContextMenuSub({
    label,
    icon,
    children
}: {
    label: ReactNode;
    icon?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="relative group/sub w-full">
            <button className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-fg hover:bg-fg/10 transition-colors rounded-sm">
                <span className="flex items-center gap-2">
                    {icon && <span className="shrink-0 flex items-center justify-center w-4">{icon}</span>}
                    {label}
                </span>

                <ArrowRightIcon className="text-fg-muted ml-2" />

            </button>

            <div className="absolute top-[-5px] left-full pl-1.5 hidden group-hover/sub:block z-[10000]">
                <div className="flex flex-col min-w-[220px] bg-bg-elevated border border-border rounded-md shadow-lg p-1">
                    {children}
                </div>
            </div>
        </div>
    );
}