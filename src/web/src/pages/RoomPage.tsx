import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useRoom } from '@/features/rooms/useRoom';
import { useRoomStore } from '@/features/rooms/roomStore';
import { clearLastRoom, rememberRoom } from '@/features/rooms/lastRoom';
import { useAuth } from '@/features/auth/useAuth';
import { getTrack } from '@/shared/api/catalog';
import { cn } from '@/shared/lib/cn';
import { InfoIcon, MusicIcon } from '@/shared/ui/icons';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { batchUsers } from '@/shared/api/users';

export function RoomPage() {
    const { id } = useParams();
    const [params] = useSearchParams();
    const requestDj = params.get('dj') === '1';
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!id) {
        return (
            <div className="p-8 text-center">
                <p className="text-danger font-medium rounded bg-danger/10 py-3 border border-danger/20 inline-block px-6">
                    Не указан roomId.
                </p>
            </div>
        );
    }

    return (
        <RoomPageInner
            roomId={id}
            requestDj={requestDj}
            userName={user?.displayName ?? user?.email ?? 'Гость'}
            onLeave={() => {
                clearLastRoom();
                navigate('/rooms');
            }}
        />
    );
}

function RoomPageInner({
    roomId,
    requestDj,
    userName: _userName,
    onLeave,
}: {
    roomId: string;
    requestDj: boolean;
    userName: string;
    onLeave: () => void;
}) {
    useRoom(roomId, requestDj);

    useEffect(() => {
        rememberRoom(roomId, requestDj);
    }, [roomId, requestDj]);

    const isDj = useRoomStore((s) => s.isDj);
    const participants = useRoomStore((s) => s.participants);
    const current = useRoomStore((s) => s.current);
    const rejected = useRoomStore((s) => s.rejected);

    const participantIds = participants.map(p => p.userId).sort();
    const avatarsQ = useQuery({
        queryKey: ['user-names', ...participantIds],
        queryFn: () => batchUsers(participantIds),
        enabled: participantIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });
    const avatarMap = new Map((avatarsQ.data ?? []).map(u => [u.id, u.avatarUrl]));

    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(t);
    }, [copied]);

    function copyLink() {
        const url = `${window.location.origin}/rooms/${roomId}`;
        navigator.clipboard.writeText(url).then(() => setCopied(true));
    }

    return (
        <article className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded bg-accent/10 text-xs font-bold text-accent uppercase tracking-widest border border-accent/20">
                            DJ-комната
                        </span>
                        {isDj ? (
                            <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded border border-success/20">Вы управляете плеером</span>
                        ) : (
                            <span className="text-xs font-medium text-fg-muted bg-bg px-2 py-1 rounded border border-border">Слушатель (пульт у DJ)</span>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-fg">{roomId}</h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={copyLink}
                        className={cn(
                            "flex-1 md:flex-none rounded border px-4 py-2.5 text-sm font-medium transition-all",
                            copied
                                ? "bg-success/10 border-success/40 text-success"
                                : "border-border bg-bg-elevated hover:border-accent hover:text-accent shadow-sm"
                        )}
                    >
                        {copied ? 'Ссылка скопирована!' : 'Копировать ссылку'}
                    </button>
                    <button
                        onClick={onLeave}
                        className="rounded border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger hover:text-white transition-colors"
                    >
                        Выйти
                    </button>
                </div>
            </header>

            {rejected && !isDj && (
                <div className="rounded border border-danger/40 bg-danger/10 p-4 text-sm text-danger flex items-center gap-3 shadow-sm">
                    <InfoIcon className="w-6 h-6 shrink-0" />
                    <div>
                        <strong className="font-semibold block">Внимание</strong>
                        <span>DJ-слот уже занят ({rejected}). Вы подключены как слушатель.</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* PLAYER */}
                <section className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold tracking-tight text-fg">Сейчас играет</h2>
                    {current ? (
                        <NowPlayingCard
                            trackId={current.trackId}
                            fallbackTitle={current.title}
                            fallbackArtist={current.artist}
                            isPlaying={current.isPlaying}
                            position={current.position}
                        />
                    ) : (
                        <div className="rounded border border-dashed border-border bg-bg/50 p-10 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mb-4 shadow-sm border border-border">
                                <MusicIcon className="w-8 h-8 text-fg-muted" />
                            </div>
                            <h3 className="text-lg font-medium text-fg">Тишина...</h3>
                            <p className="mt-2 text-sm text-fg-muted max-w-md">
                                DJ ещё ничего не запустил. {isDj && 'Включите любой трек в каталоге, и он синхронно заиграет у всех участников.'}
                            </p>
                        </div>
                    )}

                    {!isDj && (
                        <p className="text-[11px] text-fg-muted uppercase tracking-wider mt-4 text-center lg:text-left">
                            В режиме слушателя вы можете ставить паузу локально. Чтобы снова синхронизироваться с DJ — нажмите Play.
                        </p>
                    )}
                </section>

                {/* CURRENT USERS */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold tracking-tight text-fg">Участники</h2>
                        <span className="bg-bg-elevated border border-border rounded-full px-2.5 py-0.5 text-xs font-bold">
                            {participants.length}
                        </span>
                    </div>

                    <ul className="flex flex-col gap-2">
                        {participants.map((p) => (
                            <li
                                key={p.userId}
                                className="flex items-center gap-3 p-3 rounded border border-border bg-bg-elevated shadow-sm hover:border-accent/40 transition-colors group"
                            >
                                <Link
                                    to={`/users/${p.userId}`}
                                    className="shrink-0 transition-transform group-hover:scale-105"
                                >
                                    <UserAvatar
                                        avatarUrl={avatarMap.get(p.userId) ?? null}
                                        displayName={p.userName}
                                        size={40}
                                    />
                                </Link>

                                <div className="flex-1 min-w-0 flex items-center justify-between">
                                    <Link
                                        to={`/users/${p.userId}`}
                                        className="truncate font-medium text-sm hover:text-accent hover:underline transition-colors"
                                    >
                                        {p.userName}
                                    </Link>
                                    {p.isDj && (
                                        <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent uppercase tracking-widest ml-2 shrink-0">
                                            DJ
                                        </span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

        </article>
    );
}

function NowPlayingCard({
    trackId,
    fallbackTitle,
    fallbackArtist,
    isPlaying,
    position,
}: {
    trackId: string;
    fallbackTitle: string;
    fallbackArtist: string | null;
    isPlaying: boolean;
    position: number;
}) {
    const trackQ = useQuery({
        queryKey: ['track', trackId],
        queryFn: () => getTrack(trackId),
        enabled: !!trackId,
        staleTime: 60_000,
    });

    const t = trackQ.data;
    const title = t?.title ?? fallbackTitle;
    const artist = t?.artist ?? fallbackArtist;
    const artistId = t?.artistId ?? null;
    const coverUrl = t?.coverUrl ?? null;
    const featured = t?.featuredArtists ?? [];

    return (
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded border border-border bg-bg-elevated p-6 shadow-sm">
            <div
                className="w-40 h-40 shrink-0 rounded border border-border bg-bg flex items-center justify-center shadow-md bg-cover bg-center"
                style={{ backgroundImage: coverUrl ? `url("${coverUrl.replace(/"/g, '\\"')}")` : undefined }}
                aria-hidden
            >
                {!coverUrl && <MusicIcon className="w-12 h-12 text-fg-muted opacity-30" />}
            </div>

            <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left w-full">
                <div>
                    <Link
                        to={`/tracks/${trackId}`}
                        className="block truncate text-2xl font-bold tracking-tight hover:underline hover:text-accent transition-colors"
                        title={title}
                    >
                        {title}
                    </Link>

                    <div className="mt-1 flex flex-wrap items-baseline justify-center sm:justify-start gap-x-2 text-base text-fg-muted font-medium">
                        {artistId ? (
                            <Link
                                to={`/artists/${artistId}`}
                                className="hover:text-fg hover:underline transition-colors"
                            >
                                {artist ?? '—'}
                            </Link>
                        ) : (
                            <span>{artist ?? '—'}</span>
                        )}

                        {featured.length > 0 && (
                            <span className="text-sm">
                                feat.{' '}
                                {featured.map((fa, idx) => (
                                    <span key={fa.id}>
                                        {idx > 0 && ', '}
                                        <Link
                                            to={`/artists/${fa.id}`}
                                            className="hover:text-fg hover:underline transition-colors"
                                        >
                                            {fa.name}
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                </div>

                <div className="inline-flex items-center gap-3 bg-bg px-4 py-2 rounded border border-border">
                    <span className="relative flex h-3 w-3">
                        {isPlaying && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        )}
                        <span className={cn("relative inline-flex rounded-full h-3 w-3", isPlaying ? "bg-accent" : "bg-fg-muted")}></span>
                    </span>
                    <span className="text-sm font-medium text-fg uppercase tracking-wider">
                        {isPlaying ? 'Воспроизводится' : 'На паузе'}
                    </span>
                    <span className="text-sm font-mono text-fg-muted border-l border-border pl-3">
                        {formatPosition(position)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function formatPosition(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}