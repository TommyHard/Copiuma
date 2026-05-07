import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPlaylist } from '@/shared/api/playlists';
import type { PlaylistVisibility } from '@/shared/types';

export function CreatePlaylistDialog({
    open,
    onClose,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    onCreated?: (playlistId: string) => void;
}) {
    const qc = useQueryClient();
    const [title, setTitle] = useState('');
    const [visibility, setVisibility] = useState<PlaylistVisibility>('Private');
    const [collab, setCollab] = useState(false);

    const m = useMutation({
        mutationFn: () => createPlaylist({ title: title.trim(), visibility, isCollaborative: collab }),
        onSuccess: (p) => {
            qc.invalidateQueries({ queryKey: ['playlists'] });
            onCreated?.(p.id);
            onClose();
            setTitle('');
            setVisibility('Private');
            setCollab(false);
        },
    });

    if (!open) return null;

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!title.trim()) return;
        m.mutate();
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl"
            >
                <h2 className="text-xl font-bold">Новый плейлист</h2>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-fg-muted">Название</span>
                    <input
                        autoFocus
                        type="text"
                        required
                        maxLength={120}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Название вашего плейлиста"
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm font-medium text-fg-muted">Видимость</span>
                    <select
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value as PlaylistVisibility)}
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value="Private">Только я и приглашённые</option>
                        <option value="Unlisted">Unlisted (по ссылке)</option>
                        <option value="Public">Публичный</option>
                    </select>
                </label>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                        type="checkbox"
                        checked={collab}
                        onChange={(e) => setCollab(e.target.checked)}
                        className="size-4 accent-accent"
                    />
                    <span>Участники могут добавлять треки</span>
                </label>

                {m.isError && <p className="text-sm text-danger">Не удалось создать.</p>}

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium hover:underline text-fg"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={m.isPending || !title.trim()}
                        className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {m.isPending ? 'Создаём…' : 'Создать'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}