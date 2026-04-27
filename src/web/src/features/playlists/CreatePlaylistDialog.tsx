import { useState, type FormEvent } from 'react';
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-bg-elevated p-6"
            >
                <h2 className="text-xl font-semibold">Новый плейлист</h2>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Название</span>
                    <input
                        autoFocus
                        type="text"
                        required
                        maxLength={120}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Видимость</span>
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

                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={collab}
                        onChange={(e) => setCollab(e.target.checked)}
                        className="size-4 accent-accent"
                    />
                    Совместный (участники могут добавлять треки)
                </label>

                {m.isError && <p className="text-sm text-danger">Не удалось создать.</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md border border-border px-3 py-1.5 hover:bg-bg"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={m.isPending || !title.trim()}
                        className="rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {m.isPending ? 'Создаём…' : 'Создать'}
                    </button>
                </div>
            </form>
        </div>
    );
}