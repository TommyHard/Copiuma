import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { clearLastRoom, getLastRoom } from '@/features/rooms/lastRoom';
import { UsersIcon, MusicIcon } from '@/shared/ui/icons';

export function RoomsLandingPage() {
    const navigate = useNavigate();
    const [joinId, setJoinId] = useState('');
    const [last, setLast] = useState(() => getLastRoom());

    function createRoom() {
        const id = crypto.randomUUID().slice(0, 12);
        navigate(`/rooms/${id}?dj=1`);
    }

    function join() {
        const id = joinId.trim();
        if (!id) return;
        navigate(`/rooms/${id}`);
    }

    function resumeLast() {
        if (!last) return;
        navigate(last.asDj ? `/rooms/${last.id}?dj=1` : `/rooms/${last.id}`);
    }

    function forgetLast() {
        clearLastRoom();
        setLast(null);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-12 px-4">
            <section className="w-full max-w-lg space-y-6">

                <header className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded bg-gradient-to-br from-accent/20 to-accent/5 text-accent mb-4 shadow-sm border border-accent/10">
                        <UsersIcon className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-fg">DJ-комнаты</h1>
                    <p className="mt-2 text-sm text-fg-muted max-w-sm mx-auto text-justify leading-relaxed">
                        Слушайте музыку вместе с друзьями. Один человек управляет плеером, остальные синхронно наслаждаются треками.
                    </p>
                </header>

                {last && (
                    <div className="rounded border border-accent/30 bg-accent/5 p-5 shadow-sm transition-all hover:border-accent/50">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-fg tracking-tight">Вернуться в комнату</h2>
                                <p className="mt-1 text-sm text-fg-muted flex items-center gap-2 flex-wrap">
                                    <span className="font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border text-xs">
                                        {last.id}
                                    </span>
                                    {last.asDj && (
                                        <span className="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent uppercase tracking-widest">DJ</span>
                                    )}
                                    {last.enteredAt && (
                                        <span className="text-xs opacity-70">
                                            вход {new Date(last.enteredAt).toLocaleString('ru-RU')}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={resumeLast}
                                className="flex-1 rounded bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity shadow-md"
                            >
                                Войти
                            </button>
                            <button
                                onClick={forgetLast}
                                className="rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-fg hover:bg-border transition-colors"
                            >
                                Забыть
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid gap-6">
                    <div className="rounded border border-border bg-bg-elevated p-6 shadow-sm transition-all hover:shadow-md">
                        <h2 className="text-lg font-semibold tracking-tight text-fg">Создать новую комнату</h2>
                        <p className="mt-1.5 text-sm text-fg-muted">
                            Вы получите временный ID комнаты и станете её DJ. Ссылку можно будет отправить друзьям.
                        </p>
                        <button
                            onClick={createRoom}
                            className="mt-5 w-full flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
                        >
                            <MusicIcon className="w-4 h-4" />
                            Создать и стать DJ
                        </button>
                    </div>

                    <div className="rounded border border-border bg-bg-elevated p-6 shadow-sm transition-all hover:shadow-md">
                        <h2 className="text-lg font-semibold tracking-tight text-fg">Войти по ссылке</h2>
                        <p className="mt-1.5 text-sm text-fg-muted">
                            Вставьте ID комнаты или последний сегмент ссылки для подключения.
                        </p>
                        <div className="mt-5 flex gap-2">
                            <input
                                type="text"
                                value={joinId}
                                onChange={(e) => setJoinId(e.target.value)}
                                placeholder="Например: a1b2c3d4"
                                className="flex-1 rounded border border-border bg-bg px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            />
                            <button
                                onClick={join}
                                disabled={!joinId.trim()}
                                className="flex items-center gap-2 rounded border border-border bg-bg-elevated px-5 py-2.5 text-sm font-medium hover:bg-accent/10 hover:text-accent disabled:opacity-50 disabled:hover:bg-bg-elevated disabled:hover:text-fg transition-colors"
                            >
                                Войти
                            </button>
                        </div>
                    </div>
                </div>

            </section>
        </div>
    );
}