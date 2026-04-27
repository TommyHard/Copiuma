import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRoom } from '@/features/rooms/useRoom';
import { useRoomStore } from '@/features/rooms/roomStore';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Страница DJ-комнаты. URL: /rooms/{id}?dj=1
 *
 * UX:
 *  - Покажи список участников и текущий трек.
 *  - Если ты DJ — обычный плеер в шапке/внизу управляет всем (room-hook слушает
 *    изменения player и шлёт SendPlay/Pause/Seek). Доп. показываем,
 *    что ты DJ.
 *  - Если ты listener — плеер всё ещё работает, но любые твои клики на нём будут
 *    инвалидированы следующим heartbeat DJ
 */
export function RoomPage() {
    const { id } = useParams();
    const [params] = useSearchParams();
    const requestDj = params.get('dj') === '1';
    const { user } = useAuth();
    const navigate = useNavigate();

    if (!id) {
        return <p className="text-danger">Не указан roomId.</p>;
    }

    return (
        <RoomPageInner roomId={id} requestDj={requestDj} userName={user?.displayName ?? user?.email ?? 'me'} onLeave={() => navigate('/rooms')} />
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

    const isDj = useRoomStore((s) => s.isDj);
    const participants = useRoomStore((s) => s.participants);
    const current = useRoomStore((s) => s.current);
    const rejected = useRoomStore((s) => s.rejected);

    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const t = setTimeout(() => setCopied(false), 1500);
        return () => clearTimeout(t);
    }, [copied]);

    function copyLink() {
        const url = `${window.location.origin}/rooms/${roomId}`;
        navigator.clipboard.writeText(url).then(() => setCopied(true));
    }

    return (
        <article className="space-y-8">
            <header className="flex flex-wrap items-end gap-6">
                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-fg-muted">DJ-комната</p>
                    <h1 className="text-3xl font-semibold">{roomId}</h1>
                    <p className="text-sm text-fg-muted">
                        {isDj ? 'Ты DJ — управляешь плеером.' : 'Слушаешь — пульт у DJ.'}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={copyLink}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated"
                    >
                        {copied ? 'Скопировано' : 'Скопировать ссылку'}
                    </button>
                    <button
                        onClick={onLeave}
                        className="rounded-md border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                    >
                        Выйти
                    </button>
                </div>
            </header>

            {rejected && !isDj && (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                    DJ-слот занят ({rejected}). Ты слушаешь.
                </div>
            )}

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Сейчас играет</h2>
                {current ? (
                    <div className="rounded-md border border-border bg-bg-elevated p-4">
                        <div className="text-sm text-fg-muted">trackId: {current.trackId}</div>
                        <div className="text-lg font-medium">{current.title}</div>
                        <div className="text-sm text-fg-muted">{current.artist ?? '—'}</div>
                        <div className="mt-2 text-xs text-fg-muted">
                            {current.isPlaying ? '▶ воспроизводится' : '⏸ на паузе'} · {Math.round(current.position)} сек
                        </div>
                    </div>
                ) : (
                    <p className="text-fg-muted">
                        DJ ещё ничего не запустил. {isDj && 'Нажми ▶ на любом треке в каталоге — он стартует у всех.'}
                    </p>
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Участники ({participants.length})</h2>
                {participants.length === 0 && <p className="text-fg-muted">Кроме тебя пока никого.</p>}
                {participants.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {participants.map((p) => (
                            <li key={p.userId} className="flex items-center justify-between p-3 text-sm">
                                <span className="truncate font-medium">{p.userName}</span>
                                {p.isDj && (
                                    <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">DJ</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {!isDj && (
                <p className="text-xs text-fg-muted">
                    В режиме listener'а ваши изменения позиции/паузы локально применяются, но через секунду
                    перезаписываются heartbeat'ом DJ'я.
                </p>
            )}
        </article>
    );
}