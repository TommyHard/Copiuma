import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTrack } from '@/shared/api/tracks';
import type { TrackDetail } from '@/shared/types';

interface Props {
    open: boolean;
    track: TrackDetail;
    onClose: () => void;
}

const KNOWN_GENRES = [
    'rock', 'pop', 'hip-hop', 'electronic', 'jazz', 'classical',
    'r&b', 'soul', 'metal', 'folk', 'indie', 'punk', 'post-punk',
    'ambient', 'lo-fi', 'blues', 'country', 'reggae', 'alternative',
];

export function TrackEditDialog({ open, track, onClose }: Props) {
    const qc = useQueryClient();
    const [title, setTitle] = useState(track.title);
    const [genreInput, setGenreInput] = useState('');
    const [genres, setGenres] = useState<string[]>([]);
    const [isExplicit, setIsExplicit] = useState(track.isExplicit);
    const [initialized, setInitialized] = useState(false);

    if (open && !initialized) {
        setTitle(track.title);
        setGenres((track as any).genres ?? []);
        setIsExplicit(track.isExplicit);
        setInitialized(true);
    }
    if (!open && initialized) {
        setInitialized(false);
    }

    const save = useMutation({
        mutationFn: () => updateTrack(track.id, { title: title.trim(), genres, isExplicit }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['track', track.id] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
            onClose();
        },
    });

    function addGenre(g: string) {
        const norm = g.trim().toLowerCase();
        if (norm && !genres.includes(norm)) setGenres([...genres, norm]);
        setGenreInput('');
    }

    function removeGenre(g: string) {
        setGenres(genres.filter((x) => x !== g));
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

                {/* Genres */}
                <div>
                    <span className="mb-1 block text-sm text-fg-muted">Жанры</span>
                    {genres.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {genres.map((g) => (
                                <span
                                    key={g}
                                    className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs"
                                >
                                    {g}
                                    <button
                                        type="button"
                                        onClick={() => removeGenre(g)}
                                        className="leading-none text-fg-muted hover:text-danger"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input
                            list="genre-list"
                            value={genreInput}
                            onChange={(e) => setGenreInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addGenre(genreInput);
                                }
                            }}
                            placeholder="Добавить жанр…"
                            className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                        />
                        <button
                            type="button"
                            onClick={() => addGenre(genreInput)}
                            disabled={!genreInput.trim()}
                            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg disabled:opacity-40"
                        >
                            +
                        </button>
                    </div>
                    <datalist id="genre-list">
                        {KNOWN_GENRES.map((g) => (
                            <option key={g} value={g} />
                        ))}
                    </datalist>
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