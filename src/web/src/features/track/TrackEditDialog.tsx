import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateTrack } from '@/shared/api/tracks';
import { listGenres } from '@/shared/api/genres';
import { searchUsers } from '@/shared/api/users';
import type { TrackDetail, UserSearchResult } from '@/shared/types';
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
    const [featResults, setFeatResults] = useState<UserSearchResult[]>([]);
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
            try { setFeatResults(await searchUsers(featQuery)); }
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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-md space-y-5 rounded-lg border border-border bg-bg-elevated p-6"
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
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
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
                                        'rounded-full border px-3 py-1 text-xs transition-colors',
                                        selected
                                            ? 'border-accent bg-accent/15 text-accent'
                                            : 'border-border text-fg-muted hover:border-accent/50 hover:text-fg',
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
                                <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
                                    {a.name}
                                    <button type="button" onClick={() => setFeaturedArtists((p) => p.filter((x) => x.id !== a.id))} className="ml-0.5 text-fg-muted hover:text-danger">×</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="relative">
                        <input
                            type="text"
                            value={featQuery}
                            onChange={(e) => setFeatQuery(e.target.value)}
                            placeholder="Поиск пользователя…"
                            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                        {featSearching && <p className="mt-1 text-xs text-fg-muted">Поиск…</p>}
                        {featResults.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-elevated shadow-lg">
                                {featResults
                                    .filter((u) => !featuredArtists.some((a) => a.id === u.id))
                                    .map((u) => (
                                        <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-bg">
                                            <span className="text-sm">{u.displayName}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setFeaturedArtists((p) => [...p, { id: u.id, name: u.displayName }]); setFeatQuery(''); setFeatResults([]); }}
                                                className="rounded-md bg-accent px-2 py-1 text-xs text-accent-fg hover:opacity-90"
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
                <label className="flex cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={isExplicit}
                        onChange={(e) => setIsExplicit(e.target.checked)}
                        className="h-4 w-4 accent-accent"
                    />
                    <span className="text-sm">Explicit (18+)</span>
                </label>

                {save.isError && (
                    <p className="text-sm text-danger">Не удалось сохранить — попробуй снова.</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={save.isPending || !title.trim()}
                        className="rounded-md bg-accent px-4 py-2 text-sm text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {save.isPending ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                </div>
            </form>
        </div>
    );
}