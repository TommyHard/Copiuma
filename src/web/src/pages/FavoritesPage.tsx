import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listFavorites } from '@/shared/api/tracks';
import { usePlayTrack } from '@/features/player/usePlayTrack';

export function FavoritesPage() {
    const q = useQuery({ queryKey: ['favorites'], queryFn: listFavorites });
    const play = usePlayTrack();

    if (q.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (q.isError) return <p className="text-danger">Не удалось загрузить.</p>;

    if (!q.data || q.data.length === 0) {
        return (
            <section className="space-y-2">
                <h1 className="text-2xl font-semibold">Избранное</h1>
                <p className="text-fg-muted">
                    Тут будут треки, на которые ты нажал ♥ в каталоге или на странице трека.
                </p>
            </section>
        );
    }

    return (
        <section className="space-y-6">
            <h1 className="text-2xl font-semibold">Избранное</h1>
            <ul className="divide-y divide-border rounded-md border border-border">
                {q.data.map((f) => (
                    <li key={f.id} className="flex items-center gap-4 px-4 py-3 hover:bg-bg-elevated/50">
                        <button
                            onClick={() =>
                                play({
                                    id: f.id,
                                    title: f.title,
                                    artist: f.artist,
                                    duration: null,
                                    uploadedAt: '',
                                    artistId: null,
                                    albumId: null,
                                    trackNumber: null,
                                    isExplicit: false,
                                })
                            }
                            className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                            title="Играть"
                        >
                            ▶
                        </button>
                        <div className="min-w-0 flex-1">
                            <Link to={`/tracks/${f.id}`} className="block truncate font-medium hover:underline">
                                {f.title}
                            </Link>
                            <div className="truncate text-xs text-fg-muted">{f.artist ?? '—'}</div>
                        </div>
                        <span className="text-xs text-fg-muted">
                            ♥ {new Date(f.likedAt).toLocaleDateString('ru')}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}