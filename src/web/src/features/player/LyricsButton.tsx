import { Tooltip } from '@/shared/ui/Tooltip';
import { useUIStore } from '@/shared/store/uiStore';
import { cn } from '@/shared/lib/cn';
import { LyricsIcon } from '../../shared/ui/icons';

function LyricsIconButton({ active }: { active?: boolean }) {
    return (
        <div className="relative flex items-center justify-center w-5 h-5">
            <LyricsIcon className="w-5 h-5" />
            {active && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
            )}
        </div>
    );
}

export function LyricsButton() {
    const isOpen = useUIStore((s) => s.isLyricsOpen);
    const toggle = useUIStore((s) => s.toggleLyricsOpen);

    return (
        <Tooltip content={isOpen ? 'Скрыть текст' : 'Текст песни'} position="top">
            <button
                onClick={toggle}
                className={cn(
                    "relative transition-transform duration-200 hover:scale-105 active:scale-100",
                    isOpen ? "text-accent" : "text-fg-muted hover:text-fg"
                )}
                aria-label="Текст песни"
            >
                <LyricsIconButton active={isOpen} />
            </button>
        </Tooltip>
    );
}