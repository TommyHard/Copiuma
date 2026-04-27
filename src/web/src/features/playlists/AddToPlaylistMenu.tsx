import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addTrack, listPlaylists } from '@/shared/api/playlists';
import { useState } from 'react';

export function AddToPlaylistMenu({ trackId }: { trackId: string }) {
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);

    const q = useQuery({
        queryKey: ['playlists'],
        queryFn: listPlaylists,
        enabled: open,
        staleTime: 60_000,
    });

    const add = useMutation({
        mutationFn: (playlistId: string) => addTrack(playlistId, trackId),
        onSuccess: (_, playlistId) => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            setOpen(false);
        },
    });

    return (
        <details
            open={open}
            onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
            className="relative"
        >
            <summary
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-fg-muted hover:bg-bg-elevated hover:text-fg"
                title="Добавить в плейлист"
            >
                <span aria-hidden>＋</span>
            </summary>

            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-bg-elevated p-1 shadow-lg">
                {q.isLoading && <p className="p-2 text-xs text-fg-muted">Загружаем…</p>}
                {q.data && q.data.length === 0 && (
                    <p className="p-2 text-xs text-fg-muted">Нет ни одного плейлиста.</p>
                )}
                {q.data?.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => add.mutate(p.id)}
                        disabled={add.isPending}
                        className="block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-bg disabled:opacity-50"
                    >
                        {p.title}
                    </button>
                ))}
            </div>
        </details>
    );
}