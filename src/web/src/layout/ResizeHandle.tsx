import { useCallback, useRef } from 'react';

export function ResizeHandle({
    width,
    onWidthChange,
    onResizeStateChange,
    direction = 1
}: {
    width: number;
    onWidthChange: (newWidth: number) => void;
    onResizeStateChange: (isResizing: boolean) => void;
    direction?: 1 | -1;
}) {
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        startXRef.current = e.clientX;
        startWidthRef.current = width;

        onResizeStateChange(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startXRef.current;
            onWidthChange(startWidthRef.current + deltaX * direction);
        };

        const handleMouseUp = () => {
            onResizeStateChange(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [width, onWidthChange, direction, onResizeStateChange]);

    return (
        <div
            className="w-2 shrink-0 cursor-pointer bg-clip-content px-[3px] bg-transparent hover:bg-accent/50 active:bg-accent transition-colors"
            onMouseDown={handleMouseDown}
        />
    );
}