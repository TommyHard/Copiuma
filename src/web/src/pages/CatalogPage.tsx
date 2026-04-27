import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listTracks } from '@/shared/api/catalog';
import { TrackRow } from './track-row';

const PAGE_SIZE = 20;

export function CatalogPage() {
    const [page, setPage] = useState(1);

    const q = useQuery({
        queryKey: ['catalog', page],
        queryFn: () => listTracks(page, PAGE_SIZE),
    });

    return (
        <section className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Каталог</h1>
            </header>

            {q.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {q.isError && <p className="text-danger">Не удалось загрузить.</p>}

            {q.data && q.data.length === 0 && (
                <p className="text-fg-muted">Пока пусто. Артист может загрузить первый трек.</p>
            )}

            {q.data && q.data.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {q.data.map((t, i) => (
                        <TrackRow key={t.id} track={t} number={(page - 1) * PAGE_SIZE + i + 1} />
                    ))}
                </ul>
            )}

            <div className="flex items-center justify-between text-sm">
                <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || q.isLoading}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-bg-elevated disabled:opacity-50"
                >
                    ← Назад
                </button>
                <span className="text-fg-muted">Страница {page}</span>
                <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!q.data || q.data.length < PAGE_SIZE || q.isLoading}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-bg-elevated disabled:opacity-50"
                >
                    Вперёд →
                </button>
            </div>
        </section>
    );
}