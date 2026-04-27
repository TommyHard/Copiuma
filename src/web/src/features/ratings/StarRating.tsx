import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearRating, getRating, setRating } from '@/shared/api/ratings';
import { cn } from '@/shared/lib/cn';

/**
 * Виджет 5-звёздной оценки + средняя оценка/счётчик/гистограмма
 * Click по звезде -> ставит/обновляет; клик по уже выбранной -> снимает
 */
export function StarRating({ trackId }: { trackId: string }) {
    const qc = useQueryClient();
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

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                    <button
                        key={v}
                        disabled={busy || !data}
                        onClick={() => (yours === v ? drop.mutate() : set.mutate(v))}
                        className={cn(
                            'text-2xl leading-none transition-opacity',
                            v <= yours ? 'text-accent' : 'text-fg-muted/40 hover:text-fg-muted',
                            busy && 'opacity-50',
                        )}
                        aria-label={`${v} звёзд`}
                        title={`${v} из 5`}
                    >
                        ★
                    </button>
                ))}
                <span className="ml-2 text-sm text-fg-muted">
                    {data ? `${data.average.toFixed(1)} / 5 · ${data.count} оценок` : '...'}
                </span>
            </div>

            {data && data.count > 0 && (
                <div className="flex max-w-xs flex-col gap-1 text-xs text-fg-muted">
                    {[5, 4, 3, 2, 1].map((v) => {
                        const c = data.distribution[v - 1] ?? 0;
                        const pct = data.count === 0 ? 0 : Math.round((c / data.count) * 100);
                        return (
                            <div key={v} className="flex items-center gap-2">
                                <span className="w-3 text-right">{v}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded bg-bg-elevated">
                                    <div className="h-full bg-accent/70" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-8 text-right tabular-nums">{c}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}