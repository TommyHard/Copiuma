import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTracks } from '@/shared/api/catalog';
import { TrackRow } from './track-row';

export function SearchPage() {
    const [input, setInput] = useState('');
    const [debounced, setDebounced] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebounced(input.trim()), 300);
        return () => clearTimeout(t);
    }, [input]);

    const q = useQuery({
        queryKey: ['search', debounced],
        queryFn: () => searchTracks(debounced),
        enabled: debounced.length >= 2,
    });

    return (
        <section className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Поиск</h1>
            </header>

            <input
                autoFocus
                type="search"
                placeholder="Название, исполнитель, альбом…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full rounded-md border border-border bg-bg-elevated px-4 py-3 outline-none focus:border-accent"
            />

            {debounced.length < 2 && (
                <p className="text-sm text-fg-muted">Введи минимум 2 символа.</p>
            )}

            {q.isLoading && <p className="text-fg-muted">Ищем…</p>}
            {q.isError && <p className="text-danger">Поиск не сработал.</p>}

            {q.data && q.data.length === 0 && debounced && (
                <p className="text-fg-muted">Ничего не нашли по «{debounced}».</p>
            )}

            {q.data && q.data.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {q.data.map((t) => (
                        <TrackRow key={t.id} track={t} />
                    ))}
                </ul>
            )}
        </section>
    );
}