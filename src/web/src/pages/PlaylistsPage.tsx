import { useQuery } from '@tanstack/react-query';
import { listPublicPlaylists } from '@/shared/api/playlists';
import { PlaylistCover } from '@/features/playlists/PlaylistCover';
import { Link } from 'react-router-dom';

export function PlaylistsPage() {
    const pub = useQuery({
        queryKey: ['playlists-public'],
        queryFn: listPublicPlaylists,
    });

    return (
        <div className="flex flex-col min-h-full pb-10">
            <header className="px-6 py-10 md:px-10 lg:py-14 bg-gradient-to-b from-accent/10 to-transparent border-b border-border/30">
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-fg">
                    Публичные плейлисты
                </h1>
                <p className="mt-3 text-sm md:text-base text-fg-muted max-w-2xl leading-relaxed">
                    Открывайте для себя новые подборки от других пользователей.
                    Слушайте, сохраняйте и находите вдохновение.
                </p>
            </header>

            <main className="flex-1 px-6 md:px-10 mt-8">
                {pub.isLoading && (
                    <div className="flex h-40 items-center justify-center">
                        <span className="text-sm text-fg-muted animate-pulse">
                            Загрузка плейлистов...
                        </span>
                    </div>
                )}

                {pub.isError && (
                    <div className="flex h-40 items-center justify-center rounded border border-danger/20 bg-danger/5">
                        <p className="text-danger text-sm">
                            Не удалось загрузить плейлисты. Пожалуйста, попробуйте позже.
                        </p>
                    </div>
                )}

                {pub.data && pub.data.length === 0 ? (
                    <div className="flex flex-col h-40 items-center justify-center text-center">
                        <p className="text-fg font-medium">Здесь пока пусто</p>
                        <p className="text-sm text-fg-muted mt-1">
                            Никто еще не опубликовал свои плейлисты.
                        </p>
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-6 xl:gap-8">
                        {pub.data?.map((p) => (
                            <li key={p.id}>
                                <Link
                                    to={`/playlists/${p.id}`}
                                    className="flex flex-col gap-3 p-5 md:p-4 rounded-2xl hover:bg-fg/5 transition-all duration-200 group"
                                >
                                    <div className="w-full aspect-square rounded bg-bg-elevated shadow-md border border-border/50 group-hover:shadow-xl transition-shadow overflow-hidden">
                                        <PlaylistCover
                                            coverUrl={p.coverUrl}
                                            previewCovers={p.previewCovers}
                                            className="w-full h-full object-cover"
                                            rounded="none"
                                        />
                                    </div>

                                    <div className="w-full text-left px-1">
                                        <div className="font-semibold text-fg text-base truncate">
                                            {p.title}
                                        </div>
                                        <div className="text-xs text-fg-muted mt-1 truncate">
                                            {p.ownerName || 'Автор'} • {p.trackCount} {pluralTracks(p.trackCount ?? 0)}
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}

function pluralTracks(n: number): string {
    const last2 = n % 100;
    const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}