import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invite } from '@/shared/api/playlists';

export function InvitePeopleDialog({
    open,
    playlistId,
    onClose,
}: {
    open: boolean;
    playlistId: string;
    onClose: () => void;
}) {
    const qc = useQueryClient();
    const [userId, setUserId] = useState('');
    const [role, setRole] = useState('Member');

    const m = useMutation({
        mutationFn: () => invite(playlistId, userId.trim(), role),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            qc.invalidateQueries({ queryKey: ['playlist-invitations', playlistId] });
            setUserId('');
            onClose();
        },
    });

    if (!open) return null;

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!userId.trim()) return;
        m.mutate();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-bg-elevated p-6"
            >
                <h2 className="text-xl font-semibold">Пригласить участника</h2>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">User ID (UUID)</span>
                    <input
                        autoFocus
                        required
                        placeholder="00000000-0000-0000-0000-000000000000"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                    <span className="mt-1 block text-xs text-fg-muted">
                        v4: поиск по email появится в v5; пока user ID можно узнать у самого человека.
                    </span>
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Роль</span>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    >
                        <option value="Member">Member (читает)</option>
                        <option value="Editor">Editor (может добавлять треки)</option>
                    </select>
                </label>

                {m.isError && <p className="text-sm text-danger">Не удалось пригласить.</p>}

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
                        disabled={m.isPending || !userId.trim()}
                        className="rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {m.isPending ? 'Отправляем…' : 'Пригласить'}
                    </button>
                </div>
            </form>
        </div>
    );
}