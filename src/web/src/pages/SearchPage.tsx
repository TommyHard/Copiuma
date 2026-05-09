import { useEffect, useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { searchTracks, listTracks } from '@/shared/api/catalog';
import { searchUsers } from '@/shared/api/users';
import { searchArtists, searchAlbums } from '@/shared/api/artists';
import { getFollowedUsers, followUser, unfollowUser } from '@/shared/api/follows';
import { TrackRow } from './track-row';
import { cn } from '@/shared/lib/cn';
import { SearchIcon, UserIcon, MusicIcon, AlbumIcon, ArtistIcon, ChevronDownIcon } from '@/shared/ui/icons';
import { AlbumSummary, ArtistSummary } from '@/shared/types';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

export function SearchPage() {

    const qc = useQueryClient();

    const navigate = useNavigate();

    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const catalogRef = useRef<HTMLDivElement>(null);

    const [input, setInput] = useState(searchParams.get('q') || '');
    const [debounced, setDebounced] = useState(input);
    const [highlightCatalog, setHighlightCatalog] = useState(false);

    useEffect(() => {
        const query = searchParams.get('q');
        if (query) {
            setInput(query);
            setDebounced(query);
        }
    }, [searchParams]);

    useEffect(() => {
        if (location.state?.scrollToCatalog) {
            setInput('');
            setDebounced('');
            setHighlightCatalog(true);

            catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    useEffect(() => {
        if (highlightCatalog) {
            const timer = setTimeout(() => {
                setHighlightCatalog(false);
            }, 1500);

            return () => clearTimeout(timer);
        }
    }, [highlightCatalog])

    useEffect(() => {
        const t = setTimeout(() => {
            setDebounced(input.trim());
            if (input.trim().length >= 2) {
                setSearchParams({ q: input.trim() }, { replace: true });
            } else if (input.trim() === '') {
                setSearchParams({}, { replace: true });
            }
        }, 400);
        return () => clearTimeout(t);
    }, [input, setSearchParams]);

    const isValid = debounced.length >= 2;

    const trackQ = useQuery({
        queryKey: ['search-tracks', debounced],
        queryFn: () => searchTracks(debounced),
        enabled: isValid,
    });

    const userQ = useQuery({
        queryKey: ['search-users', debounced],
        queryFn: () => searchUsers(debounced),
        enabled: isValid,
    });

    const artistQ = useQuery({
        queryKey: ['search-artists', debounced],
        queryFn: () => searchArtists(debounced),
        enabled: isValid,
    });

    const albumQ = useQuery({
        queryKey: ['search-albums', debounced],
        queryFn: () => searchAlbums(debounced),
        enabled: isValid,
    });

    const catalogQ = useInfiniteQuery({
        queryKey: ['catalog-infinite'],
        queryFn: ({ pageParam = 1 }) => listTracks(pageParam, PAGE_SIZE),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        initialPageParam: 1,
    });

    const followingQ = useQuery({
        queryKey: ['following-users'],
        queryFn: getFollowedUsers,
    });

    const followedSet = useMemo(() => {
        return new Set((followingQ.data ?? []).map(u => u.userId));
    }, [followingQ.data]);

    const followM = useMutation({
        mutationFn: (userId: string) => followUser(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['following-users'] }),
    });

    const unfollowM = useMutation({
        mutationFn: (userId: string) => unfollowUser(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['following-users'] }),
    });

    const isSearching = (trackQ.isFetching || userQ.isFetching || artistQ.isFetching || albumQ.isFetching) && isValid;

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-12">
            <header className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-fg">Поиск</h1>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-fg-muted" />
                    </div>
                    <input
                        autoFocus
                        type="search"
                        placeholder="Треки, альбомы, артисты или пользователи..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full rounded-xl border border-border bg-bg-elevated pl-11 pr-4 py-3.5 text-base outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-sm"
                    />
                </div>
            </header>

            {isValid ? (
                <div className="space-y-10">
                    {isSearching && <p className="text-sm font-medium text-accent animate-pulse text-center">Ищем по всей библиотеке...</p>}

                    {/* ARTISTS */}
                    {artistQ.data && artistQ.data.length > 0 && (
                        <ResultSection title="Артисты" icon={<ArtistIcon />}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {artistQ.data.map((a: ArtistSummary) => (
                                    <Link key={a.id} to={`/artists/${a.id}`} className="flex flex-col items-center p-4 rounded-xl border border-border bg-bg-elevated hover:bg-accent/5 transition-colors group">
                                        <div className="size-20 rounded-full bg-bg border border-border mb-3 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                                            {a.avatarUrl ? <img src={a.avatarUrl} alt={a.name} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-accent bg-accent/10 text-xl font-bold">{a.name[0]}</div>}
                                        </div>
                                        <span className="text-sm font-semibold truncate w-full text-center">{a.name}</span>
                                    </Link>
                                ))}
                            </div>
                        </ResultSection>
                    )}

                    {/* ALBUMS */}
                    {albumQ.data && albumQ.data.length > 0 && (
                        <ResultSection title="Альбомы" icon={<AlbumIcon />}>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {albumQ.data.map((al: AlbumSummary) => (
                                    <Link key={al.id} to={`/albums/${al.id}`} className="space-y-2 group">
                                        <div className="aspect-square rounded-lg border border-border bg-bg shadow-sm overflow-hidden group-hover:shadow-md transition-all">
                                            {al.coverUrl ? <img src={al.coverUrl} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center bg-bg-elevated text-fg-muted"><AlbumIcon className="size-8 opacity-20" /></div>}
                                        </div>
                                        <div className="px-1 truncate">
                                            <div className="text-sm font-bold truncate group-hover:text-accent transition-colors">{al.title}</div>
                                            <div className="text-xs text-fg-muted truncate">{al.artistName}</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </ResultSection>
                    )}

                    {/* TRACKS */}
                    {trackQ.data && trackQ.data.length > 0 && (
                        <ResultSection title="Треки" icon={<MusicIcon />}>
                            <ul className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-sm">
                                {trackQ.data.map((t, i) => (
                                    <TrackRow
                                        key={t.id}
                                        track={t}
                                        playList={trackQ.data!}
                                        playListIndex={i}
                                        playListContext={{ type: 'search' }}
                                    />
                                ))}
                            </ul>
                        </ResultSection>
                    )}

                    {/* USERS */}
                    {userQ.data && userQ.data.length > 0 && (
                        <ResultSection title="Пользователи" icon={<UserIcon />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {userQ.data.map((u) => {
                                    const isFollowed = followedSet.has(u.id);
                                    return (
                                        <li key={u.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border bg-bg-elevated hover:border-accent/40 transition-colors shadow-sm group">
                                            <Link to={`/users/${u.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-accent/20 to-bg flex items-center justify-center text-lg font-bold text-accent border border-accent/10 transition-transform group-hover:scale-105">
                                                    {u.displayName?.charAt(0).toUpperCase() ?? 'U'}
                                                </div>
                                                <div className="font-semibold text-sm group-hover:text-accent transition-colors truncate">{u.displayName}</div>
                                            </Link>
                                            <button
                                                onClick={() => isFollowed ? unfollowM.mutate(u.id) : followM.mutate(u.id)}
                                                className={cn("shrink-0 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all shadow-sm", isFollowed ? "bg-bg border border-border text-fg-muted hover:text-danger hover:border-danger/50" : "bg-accent text-accent-fg border border-accent hover:opacity-90")}
                                            >
                                                {isFollowed ? 'Отписаться' : 'Подписаться'}
                                            </button>
                                        </li>
                                    );
                                })}
                            </div>
                        </ResultSection>
                    )}
                </div>
            ) : (
                <section
                    className={cn(
                        "pt-12 space-y-6 transition-all duration-500 rounded-2xl p-4",
                        highlightCatalog ? "bg-accent/5 ring-2 ring-accent/50 shadow-[0_0_20px_rgba(202,162,230,0.15)]" : ""
                    )}
                >
                    <div
                        ref={catalogRef}
                        className="flex items-center justify-between border-b border-border pb-4">
                        <h2 className="text-2xl font-bold tracking-tight text-fg">Все треки</h2>
                        <span className={cn(
                            "text-xs uppercase tracking-widest font-bold transition-colors",
                            highlightCatalog ? "text-accent" : "text-fg-muted"
                        )}>
                            Библиотека
                        </span>
                    </div>

                    <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden shadow-sm">
                        {catalogQ.data?.pages.map((page, i) => (
                            <ul key={i} className="divide-y divide-border/50">
                                {page.map((t, idx) => {
                                    const allTracks = (catalogQ.data?.pages ?? []).flat();
                                    const globalIdx = i * PAGE_SIZE + idx;
                                    return (
                                        <TrackRow
                                            key={t.id}
                                            track={t}
                                            number={globalIdx + 1}
                                            playList={allTracks}
                                            playListIndex={globalIdx}
                                            playListContext={{ type: 'popular' }}
                                        />
                                    );
                                })}
                            </ul>
                        ))}
                    </div>

                    {catalogQ.hasNextPage && (
                        <div className="flex justify-center pt-4">
                            <button
                                onClick={() => catalogQ.fetchNextPage()}
                                disabled={catalogQ.isFetchingNextPage}
                                className="flex items-center gap-2 rounded-xl bg-accent/10 px-8 py-3 text-sm font-bold text-accent border border-accent/20 hover:bg-accent/20 transition-all disabled:opacity-50 shadow-sm"
                            >
                                {catalogQ.isFetchingNextPage ? 'Загрузка...' : 'Показать еще'}
                                <ChevronDownIcon className="size-4" />
                            </button>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function ResultSection({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <section className="space-y-4">
            <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-fg px-1">
                <span className="text-accent size-5">{icon}</span>
                {title}
            </div>
            {children}
        </section>
    );
}