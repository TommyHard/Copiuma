import { useState, useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invite } from '@/shared/api/playlists';
import { searchUsers } from '@/shared/api/users';
import type { UserSearchResult } from '@/shared/types';
import { SearchIcon, CheckIcon, UserIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

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
        setRole('Editor');
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

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <form
                onClick={(e) => e.stopPropagation()}
                onSubmit={onSubmit}
                className="w-full max-w-md space-y-6 rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold tracking-tight text-fg">Пригласить участника</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1.5 text-fg-muted hover:bg-bg hover:text-fg transition-colors"
                    >
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-fg-muted">Пользователь</label>

                    {selected ? (
                        <div className="flex items-center justify-between rounded border border-accent bg-accent/10 py-2 pl-3 pr-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="size-8 shrink-0 rounded-full bg-bg overflow-hidden flex items-center justify-center border border-border">
                                    {selected.avatarUrl ? (
                                        <img src={selected.avatarUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <UserIcon className="size-4 text-fg-muted" />
                                    )}
                                </div>
                                <span className="truncate text-sm font-medium text-fg">
                                    {selected.displayName}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="shrink-0 rounded p-1.5 text-fg-muted hover:bg-bg hover:text-danger transition-colors ml-2"
                                title="Изменить"
                            >
                                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-fg-muted pointer-events-none" />
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Имя или email..."
                                className="w-full rounded border border-border bg-bg pl-9 pr-3 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent placeholder:text-fg-muted/60"
                            />
                            {searching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                            )}

                            {!selected && results.length > 0 && (
                                <ul className="absolute left-0 top-full mt-1 z-10 max-h-48 w-full overflow-y-auto rounded border border-border bg-bg shadow-xl">
                                    {results.map((u) => (
                                        <li key={u.id}>
                                            <button
                                                type="button"
                                                onClick={() => pick(u)}
                                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-bg-elevated transition-colors"
                                            >
                                                <div className="size-7 shrink-0 rounded-full bg-border flex items-center justify-center overflow-hidden">
                                                    {u.avatarUrl ? (
                                                        <img src={u.avatarUrl} alt="" className="size-full object-cover" />
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-fg-muted">{u.displayName.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                                <span className="truncate text-sm text-fg font-medium">{u.displayName}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {!searching && query.trim().length >= 2 && results.length === 0 && !selected && (
                        <p className="text-xs text-fg-muted">Пользователь не найден.</p>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-fg-muted">Права доступа</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setRole('Viewer')}
                            className={cn(
                                "flex flex-col items-start gap-1 rounded border p-3 text-left transition-colors",
                                role === 'Viewer' ? "border-accent bg-accent/5" : "border-border hover:border-fg-muted bg-bg"
                            )}
                        >
                            <span className={cn("text-sm font-bold flex items-center gap-1.5", role === 'Viewer' ? "text-accent" : "text-fg")}>
                                Viewer
                                {role === 'Viewer' && <CheckIcon className="size-3.5" />}
                            </span>
                            <span className="text-xs text-fg-muted">Слушать и смотреть</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setRole('Editor')}
                            className={cn(
                                "flex flex-col items-start gap-1 rounded border p-3 text-left transition-colors",
                                role === 'Editor' ? "border-accent bg-accent/5" : "border-border hover:border-fg-muted bg-bg"
                            )}
                        >
                            <span className={cn("text-sm font-bold flex items-center gap-1.5", role === 'Editor' ? "text-accent" : "text-fg")}>
                                Editor
                                {role === 'Editor' && <CheckIcon className="size-3.5" />}
                            </span>
                            <span className="text-xs text-fg-muted">Добавлять треки</span>
                        </button>
                    </div>
                </div>

                {m.isError && (
                    <div className="rounded border border-danger/20 bg-danger/10 p-3 text-sm text-danger flex items-center gap-2">
                        <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Не удалось пригласить. Возможно, пользователь уже в плейлисте.
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                        type="button"
                        onClick={() => { reset(); onClose(); }}
                        className="rounded px-4 py-2 text-sm font-medium text-fg hover:bg-bg transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={m.isPending || !selected}
                        className="rounded bg-accent px-5 py-2 text-sm font-bold text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {m.isPending ? 'Отправляем…' : 'Пригласить'}
                    </button>
                </div>
            </form>
        </div>,
        document.body
    );
}