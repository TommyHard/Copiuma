import { useState } from 'react';
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
        <section className="space-y-8 p-6">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Публичные плейлисты</h1>
                <p className="text-sm text-fg-muted mt-1">Открывайте новые подборки от других пользователей.</p>
            </header>

            {pub.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {pub.isError && <p className="text-danger">Не удалось загрузить плейлисты.</p>}

            {pub.data && pub.data.length === 0 ? (
                <p className="text-fg-muted">Никто еще не опубликовал плейлисты.</p>
            ) : (
                <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {pub.data?.map((p) => (
                        <li key={p.id}>
                            <Link
                                to={`/playlists/${p.id}`}
                                className="block space-y-3 rounded-xl border border-border bg-bg-elevated p-4 hover:bg-bg-elevated/70 transition-all hover:scale-[1.02]"
                            >
                                <PlaylistCover
                                    coverUrl={p.coverUrl}
                                    previewCovers={p.previewCovers}
                                    className="aspect-square w-full shadow-lg"
                                    rounded="md"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="truncate font-bold text-sm">{p.title}</span>
                                    <span className="text-[12px] text-fg-muted mt-1">
                                        {p.ownerName || 'Автор'} • {p.trackCount} {pluralTracks(p.trackCount ?? 0)}
                                    </span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function pluralTracks(n: number): string {
    const last2 = n % 100; const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}