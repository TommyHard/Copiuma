import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearRating, getRating, setRating } from '@/shared/api/ratings';
import { StarIcon, RefreshIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

export function StarRating({ trackId }: { trackId: string }) {
    const qc = useQueryClient();
    const [hoveredValue, setHoveredValue] = useState<number | null>(null);

    const q = useQuery({ queryKey: ['rating', trackId], queryFn: () => getRating(trackId) });

    const set = useMutation({
        mutationFn: (value: number) => setRating(trackId, value),
        onSuccess: (data) => qc.setQueryData(['rating', trackId], data),
    });

    const drop = useMutation({
        mutationFn: () => clearRating(trackId),
        onSuccess: (data) => qc.setQueryData(['rating', trackId], data),
    });

    const data = q.data;
    const yours = data?.yourValue ?? 0;
    const busy = set.isPending || drop.isPending;

    if (!data) {
        return (
            <div className="flex w-full max-w-4xl h-48 animate-pulse items-center justify-center rounded-2xl border border-border bg-bg-elevated text-fg-muted shadow-sm">
                Загрузка оценок...
            </div>
        );
    }

    const avg = data.average ?? 0;
    const count = data.count ?? 0;

    return (
        <div className="flex w-full flex-col md:flex-row gap-8 rounded-2xl border border-border bg-bg-elevated p-6 md:p-8 shadow-sm">

            <div className="flex min-w-[150px] shrink-0 flex-col items-center justify-center space-y-2">
                <span className="text-6xl font-black text-fg">{avg.toFixed(1)}</span>
                <div className="flex items-center gap-1 text-accent">
                    {[1, 2, 3, 4, 5].map((v) => (
                        <StarIcon
                            key={v}
                            filled={v <= Math.round(avg)}
                            className={cn("size-5", v <= Math.round(avg) ? "text-accent" : "text-border")}
                        />
                    ))}
                </div>
                <span className="mt-2 text-sm font-medium text-fg-muted">
                    {count} {pluralize(count, 'оценка', 'оценки', 'оценок')}
                </span>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-2.5 border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                {[5, 4, 3, 2, 1].map((v) => {
                    const c = data.distribution[v - 1] ?? 0;
                    const pct = count === 0 ? 0 : Math.round((c / count) * 100);

                    return (
                        <div key={v} className="group flex items-center gap-3 text-sm">
                            <div className="flex w-8 items-center gap-1 font-bold text-fg">
                                {v} <StarIcon filled className="size-3 text-fg-muted transition-colors group-hover:text-accent" />
                            </div>
                            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full border border-border/50 bg-bg">
                                <div
                                    className="absolute left-0 top-0 h-full rounded-full bg-accent transition-all duration-1000 ease-out"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <div className="w-10 text-right text-xs font-medium tabular-nums text-fg-muted">{pct}%</div>
                        </div>
                    );
                })}
            </div>

            <div className="flex shrink-0 flex-col justify-center border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                <h3 className="mb-3 text-center text-sm font-bold text-fg md:text-left">Ваша оценка</h3>
                <div className="relative flex flex-col items-center justify-center rounded-xl border border-border bg-bg p-4 shadow-inner">

                    {busy && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-bg/50 backdrop-blur-[1px]">
                            <RefreshIcon className="size-5 animate-spin text-accent" />
                        </div>
                    )}

                    <div
                        className="flex items-center gap-1.5"
                        onMouseLeave={() => setHoveredValue(null)}
                    >
                        {[1, 2, 3, 4, 5].map((v) => {
                            const isActive = (hoveredValue || yours) >= v;

                            return (
                                <button
                                    key={v}
                                    disabled={busy}
                                    onMouseEnter={() => setHoveredValue(v)}
                                    onClick={() => (yours === v ? drop.mutate() : set.mutate(v))}
                                    className={cn(
                                        'transition-all duration-200 focus:outline-none hover:scale-110 active:scale-95',
                                        isActive ? 'text-accent' : 'text-fg-muted/30 hover:text-accent/50'
                                    )}
                                    aria-label={`${v} звёзд`}
                                    title={`${v} из 5`}
                                >
                                    <StarIcon filled={isActive} className="size-8" />
                                </button>
                            );
                        })}
                    </div>

                    <span className={cn(
                        "mt-2 text-[10px] font-bold uppercase tracking-wider transition-opacity",
                        yours > 0 ? "text-accent opacity-100" : "text-fg-muted opacity-0"
                    )}>
                        {yours > 0 ? `Вы оценили на ${yours}` : 'Оцените'}
                    </span>
                </div>
            </div>

        </div>
    );
}

function pluralize(n: number, one: string, few: string, many: string) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
}