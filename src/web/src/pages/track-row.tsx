import { Link } from 'react-router-dom';
import type { TrackListItem } from '@/shared/types';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { AddToPlaylistMenu } from '@/features/playlists/AddToPlaylistMenu';

export function TrackRow({ track, number }: { track: TrackListItem; number?: number }) {
    const play = usePlayTrack();

    return (
        <li className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50">
            <button
                onClick={() => play(track)}
                className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                title="Играть"
            >
                ▶
            </button>

            {number !== undefined && (
                <span className="hidden w-6 text-right text-xs tabular-nums text-fg-muted md:inline-block">
                    {number}
                </span>
            )}

            <div className="min-w-0 flex-1">
                <Link to={`/tracks/${track.id}`} className="block truncate font-medium hover:underline">
                    {track.title}
                    {track.isExplicit && (
                        <span className="ml-2 rounded bg-fg/15 px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
                            E
                        </span>
                    )}
                </Link>
                <div className="truncate text-xs text-fg-muted">{track.artist ?? '—'}</div>
            </div>

            <span className="text-xs tabular-nums text-fg-muted">{formatDuration(track.duration)}</span>

            <AddToPlaylistMenu trackId={track.id} />
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