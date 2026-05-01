import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invite } from '@/shared/api/playlists';
import { searchUsers } from '@/shared/api/users';
import type { UserSearchResult } from '@/shared/types';

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
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [selected, setSelected] = useState<UserSearchResult | null>(null);
    const [role, setRole] = useState('Editor');
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (selected) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) { setResults([]); return; }

        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const r = await searchUsers(query);
                setResults(r);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, [query, selected]);

    const m = useMutation({
        mutationFn: () => invite(playlistId, selected!.id, role),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            qc.invalidateQueries({ queryKey: ['playlist-invitations', playlistId] });
            reset();
            onClose();
        },
    });

    function reset() {
        setQuery('');
        setResults([]);
        setSelected(null);
    }

    function pick(u: UserSearchResult) {
        setSelected(u);
        setQuery(u.displayName);
        setResults([]);
    }

    function clearSelection() {
        setSelected(null);
        setQuery('');
        setResults([]);
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!selected) return;
        m.mutate();
    }

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={onClose}>
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-bg-elevated p-6">
                <h2 className="text-xl font-semibold">Пригласить участника</h2>

                <div className="relative">
                    <span className="mb-1 block text-sm text-fg-muted">Имя или email</span>

                    <div className="flex items-center gap-2">
                        <input
                            autoFocus
                            value={query}
                            onChange={(e) => { if (selected) clearSelection(); setQuery(e.target.value); }}
                            placeholder="Начни вводить имя или email…"
                            disabled={!!selected}
                            className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"/>
                        {selected && (
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="shrink-0 rounded-md border border-border px-2 py-2 text-xs text-fg-muted hover:text-danger"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Dropdown */}
                    {results.length > 0 && !selected && (
                        <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-elevated shadow-lg">
                            {results.map((u) => (
                                <li key={u.id}>
                                    <button
                                        type="button"
                                        onClick={() => pick(u)}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-bg"
                                    >
                                        {u.displayName}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {searching && <p className="mt-1 text-xs text-fg-muted">Поиск…</p>}
                    {!searching && query.trim().length >= 2 && results.length === 0 && !selected && (
                        <p className="mt-1 text-xs text-fg-muted">Пользователь не найден.</p>
                    )}
                    {selected && (
                        <p className="mt-1 text-xs text-success">✓ {selected.displayName}</p>
                    )}
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Роль</span>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent">
                        <option value="Viewer">Viewer — только слушать</option>
                        <option value="Editor">Editor — добавлять треки</option>
                    </select>
                </label>

                {m.isError && (
                    <p className="text-sm text-danger">Не удалось пригласить. Проверь, не в плейлисте ли уже.</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={() => { reset(); onClose(); }}
                        className="rounded-md border border-border px-3 py-1.5 hover:bg-bg">
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={m.isPending || !selected}
                        className="rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:opacity-90 disabled:opacity-50">
                        {m.isPending ? 'Отправляем…' : 'Пригласить'}
                    </button>
                </div>
            </form>
        </div>
    );
}