import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    className?: string;
    position?: TooltipPosition;
}

export function Tooltip({ children, content, className, position = 'top' }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });

    const triggerRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

        const updatePosition = () => {
            const triggerRect = triggerRef.current!.getBoundingClientRect();
            const tooltipRect = tooltipRef.current!.getBoundingClientRect();

            let top = 0;
            let left = 0;
            const gap = 8;

            switch (position) {
                case 'top':
                    top = triggerRect.top - tooltipRect.height - gap;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = triggerRect.bottom + gap;
                    left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.left - tooltipRect.width - gap;
                    break;
                case 'right':
                    top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                    left = triggerRect.right + gap;
                    break;
            }

            setCoords({ top, left });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isVisible, position]);

    return (
        <>
            <span
                ref={triggerRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="inline-flex"
            >
                {children}
            </span>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    style={{ top: coords.top, left: coords.left }}
                    className={cn(
                        "fixed z-[9999] px-1.5 py-0.5 pointer-events-none",
                        "bg-bg-elevated border border-border text-[12px] text-fg font-medium rounded",
                        "shadow-sm whitespace-nowrap",
                        className
                    )}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
}