import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { useState, useEffect, useRef } from 'react';
import { getArtist, listArtistAlbums, listArtistTracks } from '@/shared/api/artists';
import { blockArtist, unblockArtist } from '@/shared/api/blocks';
import type { AlbumSummary, TrackListItem } from '@/shared/types';
import { TrackRow } from './track-row';
import { FollowArtistButton } from '@/features/follows/FollowArtistButton';
import { ReportButton } from '@/features/reports/ReportButton';
import { useAverageColor } from '@/shared/hooks/useAverageColor';
import { MusicIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

export function ArtistPage() {
    const { id } = useParams<{ id: string }>();
    const [scrollY, setScrollY] = useState(0);
    const pageRef = useRef<HTMLDivElement>(null);

    const { user } = useAuth();
    const qc = useQueryClient();

    const artistQ = useQuery({
        queryKey: ['artist', id],
        queryFn: () => getArtist(id!),
        enabled: !!id,
    });

    const tracksQ = useQuery({
        queryKey: ['artist-tracks', id],
        queryFn: () => listArtistTracks(id!),
        enabled: !!id,
    });

    const albumsQ = useQuery({
        queryKey: ['artist-albums', id],
        queryFn: () => listArtistAlbums(id!),
        enabled: !!id,
    });

    const artist = artistQ.data;
    const bannerColor = useAverageColor(artist?.bannerUrl);

    useEffect(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (!scrollContainer) return;

        const handleScroll = () => {
            setScrollY(scrollContainer.scrollTop);
        };

        handleScroll();

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    const isBlocked = artist?.isBlockedByMe ?? false;
    const toggleBlock = useMutation({
        mutationFn: () => isBlocked ? unblockArtist(artist!.id) : blockArtist(artist!.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['artist', id] });
            qc.invalidateQueries({ queryKey: ['blocked-artists'] });
            qc.invalidateQueries({ queryKey: ['recommendations'] });
        }
    });

    if (artistQ.isLoading) return <div className="p-8 text-fg-muted animate-pulse">Загрузка...</div>;
    if (artistQ.isError || !artist) return <div className="p-8 text-danger">Исполнитель не найден.</div>;

    const isOwner = !!user && !!artist && (artist.ownerUserId === user.id || artist.createdByUserId === user.id);

    const gradientBaseColor = (bannerColor || 'var(--accent-color, rgba(0, 0, 0, 0))');

    const BANNER_HEIGHT = 450;

    const bannerScale = Math.max(1, 1.1 - (scrollY / BANNER_HEIGHT) * 0.7);
    const colorOverlayOpacity = Math.min(1, (scrollY / BANNER_HEIGHT) * 3);

    const isStickyVisible = scrollY > BANNER_HEIGHT;

    return (
        <div ref={pageRef} className="relative flex flex-col min-h-full pb-32">

            {/* STICKY HEADER */}
            <div className="sticky top-0 z-50 w-full h-0 pointer-events-none">
                <div
                    className={cn(
                        "absolute top-0 left-0 w-full h-[5vh] min-h-[70px] flex items-center px-8 transition-all duration-300 pointer-events-auto",
                        isStickyVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"
                    )}
                    style={{ backgroundColor: gradientBaseColor }}
                >
                    <span className="text-[1.3rem] font-black text-white">
                        {artist.name} {isBlocked && "(Заблокирован)"}
                    </span>
                </div>
            </div>

            {/* BANNER */}
            <div className="relative h-[450px] w-full shrink-0 overflow-hidden bg-bg border-b border-black">

                <div
                    className={cn(
                        "absolute inset-0 origin-center transition-all duration-700",
                        isBlocked && "grayscale blur-[2px] opacity-100"
                    )}
                    style={{
                        transform: `scale(${bannerScale})`,
                        backgroundImage: artist.bannerUrl ? `url(${artist.bannerUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}
                />

                <div
                    className="absolute inset-0 transition-colors duration-500"
                    style={{
                        backgroundColor: gradientBaseColor,
                        opacity: colorOverlayOpacity
                    }}
                />

                <div className="absolute md:bottom-7 md:left-5 text-left z-10 pointer-events-none">
                    <h1 className={cn(
                        "text-6xl md:text-8xl font-black tracking-wide text-white drop-shadow-2xl transition-colors"
                    )}>
                        {artist.name}
                    </h1>
                    <div className="mt-5 mx-2 text-white/80 drop-shadow-md text-[1.1rem] flex items-center gap-3">
                        <span>{artist.followers?.toLocaleString() || 0} слушателей</span>
                        {isBlocked && (
                            <span className="px-3 py-0.5 bg-danger rounded text-xs font-bold tracking-widest text-white">
                                Заблокирован
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* GRADIENT BELOW BANNER */}
            <div
                className="absolute left-0 w-full pointer-events-none transition-colors duration-500"
                style={{
                    top: '450px',
                    height: '200px',
                    background: `linear-gradient(to bottom, ${gradientBaseColor} 0%, transparent 100%)`,
                }}
            />

            <div className="px-6 md:px-12 pt-6 relative z-10 space-y-16">

                {/* ПРЕДУПРЕЖДЕНИЕ О БЛОКИРОВКЕ */}
                {isBlocked && (
                    <div className="bg-danger/10 border border-danger/30 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-danger font-bold text-lg">Вы заблокировали этого артиста</h3>
                            <p className="text-sm mt-1">Треки этого исполнителя исключены из ваших рекомендаций и не будут воспроизводиться.</p>
                        </div>
                    </div>
                )}

                {/* BUTTONS */}
                <div className="space-y-12">
                    {!isOwner && (
                        <div className="flex flex-wrap items-center gap-4">
                            <FollowArtistButton
                                artistId={artist.id}
                                disabled={isBlocked}
                                className={cn(
                                    "h-10 px-6 rounded-md font-bold text-white shadow-sm transition-colors",
                                    isBlocked ? "cursor-not-allowed opacity-50" : "bg-accent hover:bg-accent/90"
                                )}
                            />

                            {/* КНОПКА БЛОКИРОВКИ */}
                            <button
                                onClick={() => toggleBlock.mutate()}
                                disabled={toggleBlock.isPending}
                                className={cn(
                                    "h-10 rounded px-4 font-medium text-sm text-white transition-all disabled:opacity-50",
                                    isBlocked
                                        ? "text-danger bg-danger/100 hover:bg-danger/20"
                                        : "bg-danger hover:bg-bg-elevated text-fg-muted hover:text-danger"
                                )}
                            >
                                {toggleBlock.isPending ? 'Загрузка...' : (isBlocked ? 'Разблокировать' : 'Заблокировать')}
                            </button>

                            <ReportButton targetType="User" targetId={artist.id} />
                        </div>
                    )}

                    {/* LIKED */}
                    <div className={cn("space-y-4", isBlocked && "opacity-50 pointer-events-none")}>
                        <h3 className="text-2xl font-bold tracking-tight">Вам понравилось</h3>
                        <div className="flex items-center gap-4 w-max">
                            <div className="size-24 rounded-full overflow-hidden shrink-0">
                                {artist.avatarUrl ? (
                                    <img
                                        src={artist.avatarUrl}
                                        alt={artist.name}
                                        className={cn("h-full w-full object-cover", isBlocked && "grayscale")}
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-accent/50 bg-bg-elevated">
                                        <MusicIcon className="size-8" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-base font-bold text-fg leading-tight">
                                    {artist.trackCount || 0} треков
                                </span>
                                <span className="text-sm text-fg-muted font-medium">
                                    От {artist.name}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Если артист заблокирован - low opacity */}
                <div className={cn("space-y-16 transition-opacity duration-500", isBlocked && "opacity-40 pointer-events-none grayscale")}>
                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Популярные треки</h2>
                        <div className="rounded-lg border border-border bg-bg-elevated/40 backdrop-blur-sm overflow-hidden">
                            {tracksQ.data?.slice(0, 5).map((track: TrackListItem, i: number) => (
                                <TrackRow key={track.id} track={track} number={i + 1} />
                            ))}
                        </div>
                    </section>

                    {/* Дискография */}
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold tracking-tight">Дискография</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {albumsQ.data?.map((album: AlbumSummary) => (
                                <Link
                                    key={album.id}
                                    to={`/albums/${album.id}`}
                                    className="group p-2 rounded-lg transition-all duration-300 border border-transparent hover:border-border/40 hover:bg-accent/40 shadow-none hover:shadow-xl"
                                >
                                    <div className="aspect-square rounded-lg overflow-hidden bg-bg shadow-2xl mb-5 relative">
                                        {album.coverUrl ? (
                                            <img src={album.coverUrl} alt={album.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-accent/5">
                                                <MusicIcon className="size-32 text-accent/10" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="truncate font-black text-lg text-fg group-hover:text-white transition-colors">{album.title}</h3>
                                        <p className="text-sm text-fg-muted font-medium group-hover:text-white/80 transition-colors">
                                            {album.releasedAt ? new Date(album.releasedAt).getFullYear() + ' ' + '•' : ''} Альбом
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Об артисте */}
                    <section className="space-y-6">
                        <h2 className="text-2xl font-bold tracking-tight">Об артисте</h2>
                        <div className="overflow-hidden rounded-lg border border-border shadow-2xl transition-transform duration-700 ease-in-out hover:scale-[1.05] cursor-default">
                            <div className="relative min-h-[600px] flex flex-col justify-end bg-bg-elevated">
                                <div
                                    className="absolute inset-0 opacity-30 grayscale transition-all duration-700"
                                    style={{
                                        backgroundImage: artist.bannerUrl ? `url(${artist.bannerUrl})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/20 to-transparent" />

                                <div className="relative p-10 md:p-10 flex flex-col items-start text-left w-full md:w-3/4 z-10">
                                    <div className="text-xl md:text-1xl font-bold tracking-tight drop-shadow-md">
                                        {artist.followers?.toLocaleString() || 0} слушателей
                                    </div>
                                    <p className="text-base md:text-lg leading-relaxed tracking-tight font-medium max-w-2xl drop-shadow-sm mt-0">
                                        {artist.bio || ""}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}