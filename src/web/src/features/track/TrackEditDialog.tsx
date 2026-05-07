import { useState, useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateTrack } from '@/shared/api/tracks';
import { listGenres } from '@/shared/api/genres';
import { searchArtists } from '@/shared/api/artists';
import type { ArtistSummary, TrackDetail } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

interface Props {
    open: boolean;
    track: TrackDetail;
    onClose: () => void;
}

export function TrackEditDialog({ open, track, onClose }: Props) {
    const qc = useQueryClient();
    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
        staleTime: 10 * 60 * 1000,
    });
    const [title, setTitle] = useState(track.title);
    const [genres, setGenres] = useState<string[]>([]);
    const [isExplicit, setIsExplicit] = useState(track.isExplicit);
    const [featuredArtists, setFeaturedArtists] = useState<{ id: string; name: string }[]>([]);
    const [featQuery, setFeatQuery] = useState('');
    const [featResults, setFeatResults] = useState<ArtistSummary[]>([]);
    const [featSearching, setFeatSearching] = useState(false);
    const featDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [initialized, setInitialized] = useState(false);

    if (open && !initialized) {
        setTitle(track.title);
        setGenres((track as any).genres ?? []);
        setIsExplicit(track.isExplicit);
        setFeaturedArtists((track as any).featuredArtists ?? []);
        setInitialized(true);
    }
    if (!open && initialized) {
        setInitialized(false);
    }

    useEffect(() => {
        if (featDebounceRef.current) clearTimeout(featDebounceRef.current);
        if (featQuery.trim().length < 2) { setFeatResults([]); return; }
        featDebounceRef.current = setTimeout(async () => {
            setFeatSearching(true);
            try { setFeatResults(await searchArtists(featQuery)); }
            catch { setFeatResults([]); }
            finally { setFeatSearching(false); }
        }, 300);
    }, [featQuery]);

    const save = useMutation({
        mutationFn: () => updateTrack(track.id, {
            title: title.trim(),
            genres,
            isExplicit,
            featuredArtistIds: featuredArtists.map(a => a.id),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['track', track.id] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
            onClose();
        },
    });

    function toggleGenre(g: string) {
        setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        save.mutate();
    }

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
            onClick={onClose}
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-md space-y-5 rounded border border-border bg-bg-elevated p-6 shadow-2xl"
            >
                <h2 className="text-xl font-semibold">Редактировать трек</h2>

                {/* Title */}
                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Название *</span>
                    <input
                        autoFocus
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded border border-border bg-bg px-3 py-2 outline-none focus:border-accent transition-colors"
                    />
                </label>

                {/* Genres clickable */}
                <div>
                    <span className="mb-2 block text-sm text-fg-muted">Жанры</span>
                    <div className="flex flex-wrap gap-2">
                        {(genresQ.data ?? []).map((g) => {
                            const selected = genres.includes(g.slug);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleGenre(g.slug)}
                                    className={cn(
                                        'rounded border px-3 py-1.5 text-xs transition-colors font-medium',
                                        selected
                                            ? 'border-accent bg-accent text-white shadow-sm'
                                            : 'border-border bg-bg-elevated text-fg hover:border-fg hover:bg-fg/5',
                                    )}
                                >
                                    {g.displayName}
                                </button>
                            );
                        })}
                    </div>
                    {genres.length > 0 && (
                        <p className="mt-2 text-xs text-fg-muted">
                            Выбрано: {genres.join(', ')}
                        </p>
                    )}
                </div>

                {/* Featured artists */}
                <div>
                    <span className="mb-1 block text-sm text-fg-muted">Доп. исполнители (feat.)</span>
                    {featuredArtists.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {featuredArtists.map((a) => (
                                <span key={a.id} className="inline-flex items-center gap-1 rounded border border-border bg-bg px-2 py-1 text-xs text-fg font-medium">
                                    {a.name}
                                    <button type="button" onClick={() => setFeaturedArtists((p) => p.filter((x) => x.id !== a.id))} className="ml-1 text-fg-muted hover:text-danger transition-colors">×</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="relative">
                        <input
                            type="text"
                            value={featQuery}
                            onChange={(e) => setFeatQuery(e.target.value)}
                            placeholder="Поиск артиста в каталоге…"
                            className="w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent transition-colors"
                        />
                        {featSearching && <p className="mt-1 text-xs text-fg-muted">Поиск…</p>}
                        {featQuery.trim().length >= 2 && !featSearching
                            && featResults.filter((a) => a.id !== track.artistId
                                && !featuredArtists.some((x) => x.id === a.id)).length === 0 && (
                                <p className="mt-1 text-xs text-fg-muted">
                                    Не нашли. Featured-исполнитель должен иметь свой профиль артиста.
                                </p>
                            )}
                        {featResults.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-border bg-bg-elevated shadow-xl">
                                {featResults
                                    .filter((a) => a.id !== track.artistId)
                                    .filter((a) => !featuredArtists.some((x) => x.id === a.id))
                                    .map((a) => (
                                        <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-fg/5 transition-colors">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {a.avatarUrl ? (
                                                    <img src={a.avatarUrl} alt="" className="size-6 shrink-0 rounded-full object-cover shadow-sm" />
                                                ) : (
                                                    <div className="size-6 shrink-0 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                                                        {a.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="truncate text-sm font-medium">{a.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setFeaturedArtists((p) => [...p, { id: a.id, name: a.name }]); setFeatQuery(''); setFeatResults([]); }}
                                                className="rounded bg-accent px-3 py-1 text-xs text-white font-medium hover:bg-accent/90 transition-colors shadow-sm"
                                            >
                                                Добавить
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Explicit */}
                <label className="flex cursor-pointer items-center gap-3 w-fit">
                    <input
                        type="checkbox"
                        checked={isExplicit}
                        onChange={(e) => setIsExplicit(e.target.checked)}
                        className="h-4 w-4 accent-accent cursor-pointer rounded border-border"
                    />
                    <span className="text-sm font-medium select-none">Explicit (18+)</span>
                </label>

                {save.isError && (
                    <p className="text-sm font-medium text-danger bg-danger/10 p-2 rounded-md">Не удалось сохранить — попробуй снова.</p>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded bg-bg hover:bg-fg/10 px-4 py-2 text-sm font-medium text-fg transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={save.isPending || !title.trim()}
                        className="rounded bg-accent hover:bg-accent/90 px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {save.isPending ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}