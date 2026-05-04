import { useState, useRef, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deletePlaylist,
    getPlaylist,
    leavePlaylist,
    removeMember,
    removeTrack,
    renamePlaylist,
    reorderTracks,
    setVisibility,
} from '@/shared/api/playlists';
import { useAuth } from '@/features/auth/useAuth';
import { usePlayer } from '@/features/player/store';
import { InvitePeopleDialog } from '@/features/playlists/InvitePeopleDialog';
import { PlaylistAuditLog } from '@/features/playlists/PlaylistAuditLog';
import { PlaylistCover } from '@/features/playlists/PlaylistCover';
import type { PlaylistTrack, PlaylistVisibility } from '@/shared/types';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { AddToPlaylistMenu } from '@/features/playlists/AddToPlaylistMenu';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { batchUsers } from '@/shared/api/users';
import { cn } from '@/shared/lib/cn';


export function PlaylistPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const playQueue = usePlayer((s) => s.playQueue);

    const [inviteOpen, setInviteOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');

    const [localOrder, setLocalOrder] = useState<string[] | null>(null);
    const dragId = useRef<string | null>(null);
    const dragOverId = useRef<string | null>(null);

    const q = useQuery({
        queryKey: ['playlist', id],
        queryFn: () => getPlaylist(id!),
        enabled: !!id,
    });

    const removeT = useMutation({
        mutationFn: (trackId: string) => removeTrack(id!, trackId),
        onSuccess: () => {
            setLocalOrder(null);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
        },
    });

    const reorder = useMutation({
        mutationFn: (ids: string[]) => reorderTracks(id!, ids),
        onSuccess: () => {
            setLocalOrder(null);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
        },
    });

    const visibility = useMutation({
        mutationFn: (v: PlaylistVisibility) => setVisibility(id!, v),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['playlist', id] }),
    });

    const removeM = useMutation({
        mutationFn: (userId: string) => removeMember(id!, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['playlist', id] }),
    });

    const leave = useMutation({
        mutationFn: () => leavePlaylist(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlists'] });
            navigate('/playlists');
        },
    });

    const remove = useMutation({
        mutationFn: () => deletePlaylist(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlists'] });
            navigate('/playlists');
        },
    });

    const rename = useMutation({
        mutationFn: (title: string) => renamePlaylist(id!, title),
        onSuccess: () => {
            setRenaming(false);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
            qc.invalidateQueries({ queryKey: ['playlists'] });
        },
    });

    function startRename(currentTitle: string) {
        setTitleDraft(currentTitle);
        setRenaming(true);
    }

    function commitRename() {
        const next = titleDraft.trim();
        if (!next || !q.data || next === q.data.title) {
            setRenaming(false);
            return;
        }
        rename.mutate(next);
    }

    function onTitleKey(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); }
    }

    const memberIds = q.data?.members?.map((m) => m.userId) ?? [];
    const memberNamesQ = useQuery({
        queryKey: ['user-names', ...memberIds.sort()],
        queryFn: () => batchUsers(memberIds),
        enabled: memberIds.length > 0,
    });
    const memberNameMap: Record<string, string> = {};
    for (const u of memberNamesQ.data ?? []) memberNameMap[u.id] = u.displayName;

    if (q.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (q.isError || !q.data) return <p className="text-danger">Плейлист не найден.</p>;

    const p = q.data;
    const isOwner = !!user && user.id === p.ownerId;
    const canEdit = isOwner || (p.isCollaborative && p.members?.find(m => m.userId === user?.id)?.role === 'Editor');

    const members = p.members || [];
    const serverTracks = [...(p.tracks || [])].sort((a, b) => a.position - b.position);

    const tracks = localOrder
        ? localOrder.map(tid => serverTracks.find(t => t.trackId === tid)!).filter(Boolean)
        : serverTracks;

    function handleDragStart(trackId: string) {
        dragId.current = trackId;
    }

    function handleDragOver(e: React.DragEvent, trackId: string) {
        e.preventDefault();
        dragOverId.current = trackId;
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const from = dragId.current;
        const to = dragOverId.current;
        dragId.current = null;
        dragOverId.current = null;
        if (!from || !to || from === to) return;

        const current = localOrder ?? serverTracks.map(t => t.trackId);
        const fromIdx = current.indexOf(from);
        const toIdx = current.indexOf(to);
        const next = [...current];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, from);
        setLocalOrder(next);
        reorder.mutate(next);
    }

    const myMember = members.find((m) => m.userId === user?.id);

    function playAll() {
        if (tracks.length === 0) return;
        playQueue(
            tracks.map((t) => ({
                id: t.trackId,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
                uploadedAt: '',
                artistId: null,
                albumId: null,
                trackNumber: null,
                isExplicit: t.isExplicit,
            })),
            0,
        );
    }

    return (
        <article className="space-y-10">
            <header className="flex flex-wrap items-end gap-6">
                <PlaylistCover
                    coverUrl={p.coverUrl}
                    previewCovers={p.previewCovers}
                    className="size-48 shrink-0 border border-border"
                    rounded="md"
                />
                <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-fg-muted">
                        {p.visibility}
                        {p.isCollaborative && ' • совместный'}
                    </p>
                    {renaming ? (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(e) => setTitleDraft(e.target.value)}
                                onKeyDown={onTitleKey}
                                onBlur={commitRename}
                                disabled={rename.isPending}
                                maxLength={200}
                                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-2xl font-semibold outline-none focus:border-accent disabled:opacity-50"
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault() /* del blur до клика */}
                                onClick={commitRename}
                                disabled={rename.isPending}
                                className="rounded-md bg-accent px-3 py-2 text-sm text-accent-fg hover:opacity-90 disabled:opacity-50"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setRenaming(false)}
                                disabled={rename.isPending}
                                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-3xl font-semibold">{p.title}</h1>
                            {isOwner && (
                                <button
                                    type="button"
                                    onClick={() => startRename(p.title)}
                                    title="Переименовать"
                                    aria-label="Переименовать плейлист"
                                    className="text-sm text-fg-muted hover:text-fg"
                                >
                                    ✎
                                </button>
                            )}
                        </div>
                    )}
                    {rename.isError && (
                        <p className="text-xs text-danger">Не удалось переименовать.</p>
                    )}
                    <p className="text-sm text-fg-muted">
                        {p.ownerName || 'Загрузка...'} • {p.trackCount ?? 0} треков
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        {tracks.length > 0 && (
                            <button
                                onClick={playAll}
                                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                            >
                                ▶ Играть всё
                            </button>
                        )}

                        {isOwner && (
                            <>
                                <select
                                    value={p.visibility}
                                    onChange={(e) => visibility.mutate(e.target.value as PlaylistVisibility)}
                                    disabled={visibility.isPending}
                                    className="rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent">
                                    <option value="Private">Private</option>
                                    <option value="Unlisted">Unlisted</option>
                                    <option value="Public">Public</option>
                                </select>
                                <button
                                    onClick={() => setInviteOpen(true)}
                                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated">
                                    + Пригласить
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('Удалить плейлист безвозвратно?')) remove.mutate();
                                    }}
                                    disabled={remove.isPending}
                                    className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
                                >
                                    Удалить
                                </button>
                            </>
                        )}

                        {!isOwner && myMember && (
                            <button
                                onClick={() => leave.mutate()}
                                disabled={leave.isPending}
                                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50"
                            >
                                Покинуть
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* tracks */}
            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Треки</h2>
                {tracks.length === 0 && (
                    <p className="text-fg-muted">
                        Пусто. Добавь треки кнопкой «＋» в любом списке.
                    </p>
                )}
                {tracks.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tracks.map((t) => (
                            <PlaylistTrackRow
                                key={t.trackId}
                                t={t}
                                canDrag={canEdit}
                                canRemove={canEdit}
                                onRemove={() => removeT.mutate(t.trackId)}
                                removing={removeT.isPending}
                                onDragStart={() => handleDragStart(t.trackId)}
                                onDragOver={(e) => handleDragOver(e, t.trackId)}
                                onDrop={handleDrop}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {/* members */}
            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Участники</h2>
                <ul className="divide-y divide-border rounded-md border border-border">
                    {members.map((m) => (
                        <li key={m.userId} className="flex items-center gap-4 p-3 text-sm">
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                    {memberNameMap[m.userId]
                                        || (m.userId === user?.id ? (user.displayName ?? user.email) : null)
                                        || m.displayName
                                        || <span className="font-mono text-xs text-fg-muted">{m.userId.slice(0, 8)}…</span>}
                                </div>
                                <div className="text-xs text-fg-muted">
                                    {m.role} • с {new Date(m.joinedAt).toLocaleDateString('ru')}
                                </div>
                            </div>
                            {isOwner && m.role !== 'Owner' && (
                                <button
                                    onClick={() => removeM.mutate(m.userId)}
                                    disabled={removeM.isPending}
                                    className="rounded-md border border-border px-2 py-1 text-xs hover:bg-bg-elevated disabled:opacity-50"
                                >
                                    Выгнать
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            {/* audit log */}
            {myMember && (
                <section className="space-y-3 pt-6 border-t border-border">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">История изменений</h2>
                        <span className="text-xs px-2 py-1 bg-bg-elevated rounded-md text-fg-muted">Видно только участникам</span>
                    </div>
                    <PlaylistAuditLog playlistId={p.id} />
                </section>
            )}

            {isOwner && id && (
                <InvitePeopleDialog
                    open={inviteOpen}
                    playlistId={id}
                    onClose={() => setInviteOpen(false)}
                />
            )}
        </article>
    );
}

function PlaylistTrackRow({
    t,
    canDrag,
    canRemove,
    onRemove,
    removing,
    onDragStart,
    onDragOver,
    onDrop,
}: {
    t: PlaylistTrack;
    canDrag?: boolean;
    canRemove?: boolean;
    onRemove: () => void;
    removing: boolean;
    onDragStart: () => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
}) {
    const play = usePlayTrack();

    const like = useToggleTrackLike();

    // Маппинг данных для плеера
    const trackForPlayer = {
        id: t.trackId,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        uploadedAt: '',
        artistId: null,
        albumId: null,
        trackNumber: null,
        isExplicit: t.isExplicit,
    };

    return (
        <li
            draggable={canDrag}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={cn(
                "flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50",
                canDrag && "cursor-grab active:cursor-grabbing"
            )}>
            {canDrag && (
                <span className="shrink-0 text-fg-muted/40 select-none" title="Перетащить">⠿</span>
            )}
            <button
                onClick={() => play(trackForPlayer as any)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                title="Играть">
                ▶
            </button>

            <span className="hidden w-6 text-right text-xs tabular-nums text-fg-muted md:inline-block">
                {t.position}
            </span>

            <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{t.title}</div>
                <div className="truncate text-xs text-fg-muted">{t.artist ?? '—'}</div>
            </div>

            <span className="text-xs tabular-nums text-fg-muted">{formatDuration(t.duration)}</span>

            <button
                onClick={() => like.mutate({ trackId: t.trackId, nextLiked: !t.isLikedByMe })}
                disabled={like.isPending}
                className={cn(
                    "text-lg transition-colors hover:scale-110 disabled:opacity-50",
                    t.isLikedByMe ? "text-accent" : "text-fg-muted hover:text-fg"
                )}
                title={t.isLikedByMe ? "Убрать из избранного" : "В избранное"}>
                ♥
            </button>

            <AddToPlaylistMenu trackId={t.trackId} />

            {canRemove && (
                <button
                    onClick={onRemove}
                    disabled={removing}
                    className="ml-2 text-xs text-fg-muted hover:text-danger disabled:opacity-50"
                    title="Убрать из плейлиста">
                    ✕
                </button>
            )}
        </li>
    );
}

function formatDuration(d: string | null): string {
    if (!d) return '—';
    const m = /^(?:\d+\.)?(\d{2}):(\d{2}):(\d{2})/.exec(d);
    if (!m) return d;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (h > 0) return `${h}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
}