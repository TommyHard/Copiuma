import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@/shared/ui/icons';
import type { ArtistSummary } from '@/shared/types';

export function ArtistSlider({ artists }: { artists: ArtistSummary[] }) {
    const scrollRef = useRef<HTMLUListElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeft(scrollLeft > 0);
        setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    };

    useEffect(() => {
        handleScroll();
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [artists]);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const clientWidth = scrollRef.current.clientWidth;
        const scrollAmount = clientWidth * 0.75;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    };

    return (
        <div className="relative group/slider -mx-2 px-2">
            {showLeft && (
                <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100">
                    <ArrowRightIcon className="rotate-180" />
                </button>
            )}
            <ul ref={scrollRef} onScroll={handleScroll} className="flex gap-4 overflow-x-auto scroll-smooth pb-6 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {artists.map((a, i) => (
                    <li key={`artist-${a.id || i}`} className="snap-start shrink-0">
                        <Link
                            to={`/artists/${a.id || (a as any).artistId}`}
                            className="flex flex-col gap-4 w-[180px] p-4 rounded-xl hover:bg-fg/5 transition-all duration-200 group"
                        >
                            <div
                                className="w-full aspect-square rounded-full bg-bg-elevated shadow-md flex items-center justify-center text-5xl font-bold text-fg-muted overflow-hidden relative bg-cover bg-center border border-border/50 group-hover:shadow-xl transition-shadow"
                                style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                            >
                                {!a.avatarUrl && a.name && <span>{a.name.charAt(0).toUpperCase()}</span>}
                            </div>
                            <div className="w-full text-left">
                                <div className="font-semibold text-fg text-base truncate">
                                    {a.name}
                                </div>
                                <div className="text-sm text-fg-muted mt-0.5">Артист</div>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
            {showRight && (
                <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100">
                    <ArrowRightIcon />
                </button>
            )}
        </div>
    );
}