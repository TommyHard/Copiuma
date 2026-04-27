import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/**
 * /rooms — лендинг. Backend не хранит публичный реестр комнат, поэтому
 * показываем только два варианта: создать новую (random id, dj=1) или войти
 * по полученной ссылке (навигация на /rooms/{id})
 */
export function RoomsLandingPage() {
    const navigate = useNavigate();
    const [joinId, setJoinId] = useState('');

    function createRoom() {
        const id = crypto.randomUUID().slice(0, 12);
        navigate(`/rooms/${id}?dj=1`);
    }

    function join() {
        const id = joinId.trim();
        if (!id) return;
        navigate(`/rooms/${id}`);
    }

    return (
        <section className="mx-auto max-w-md space-y-8 py-10">
            <header>
                <h1 className="text-2xl font-semibold">DJ-комнаты</h1>
                <p className="mt-1 text-sm text-fg-muted">
                    Совместное прослушивание: один DJ управляет, остальные синхронно слушают.
                </p>
            </header>

            <div className="rounded-md border border-border bg-bg-elevated p-4">
                <h2 className="font-medium">Создать новую</h2>
                <p className="mt-1 text-sm text-fg-muted">
                    Получишь временный room id, ссылку можно расшарить друзьям.
                </p>
                <button
                    onClick={createRoom}
                    className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                >
                    Создать и стать DJ
                </button>
            </div>

            <div className="rounded-md border border-border bg-bg-elevated p-4">
                <h2 className="font-medium">Войти по ссылке</h2>
                <p className="mt-1 text-sm text-fg-muted">
                    Вставь roomId или последний сегмент ссылки.
                </p>
                <div className="mt-3 flex gap-2">
                    <input
                        type="text"
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                        placeholder="abc123"
                        className="flex-1 rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                    />
                    <button
                        onClick={join}
                        disabled={!joinId.trim()}
                        className="rounded-md border border-border px-3 py-2 hover:bg-bg disabled:opacity-50"
                    >
                        Войти
                    </button>
                </div>
            </div>
        </section>
    );
}