import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { becomeArtist } from '@/shared/api/me';
import { listSessions, revokeSession, revokeAllOtherSessions } from '@/shared/api/sessions';

/**
 * Профиль: основная инфа, кнопка become-artist, список активных сессий
 *
 * После успешного апгрейда роли роль в JWT остаётся User до перелогина
 * Показываем подсказку "нужно войти заново"
 */
export function MePage() {
    const { user, refreshUser, logout } = useAuth();
    const qc = useQueryClient();
    const [stageName, setStageName] = useState(user?.displayName ?? '');

    const sessions = useQuery({
        queryKey: ['sessions'],
        queryFn: listSessions,
    });

    const upgrade = useMutation({
        mutationFn: () => becomeArtist(stageName.trim() || undefined),
        onSuccess: async () => {
            await refreshUser();
        },
    });

    const revoke = useMutation({
        mutationFn: (id: string) => revokeSession(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    });

    const revokeAllOthers = useMutation({
        mutationFn: () => revokeAllOtherSessions(),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    });

    if (!user) return null;

    return (
        <div className="space-y-10">
            <section className="space-y-3">
                <h1 className="text-2xl font-semibold">Профиль</h1>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                    <dt className="text-fg-muted">Email</dt>
                    <dd>{user.email}</dd>

                    <dt className="text-fg-muted">Имя</dt>
                    <dd>{user.displayName ?? '—'}</dd>

                    <dt className="text-fg-muted">Роль</dt>
                    <dd>{user.role}</dd>

                    <dt className="text-fg-muted">Email подтверждён</dt>
                    <dd>{user.emailVerified ? 'да' : 'нет'}</dd>

                    <dt className="text-fg-muted">Аккаунт создан</dt>
                    <dd>{new Date(user.createdAt).toLocaleString('ru')}</dd>
                </dl>
            </section>

            {user.role === 'User' && (
                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">Стать артистом</h2>
                    <p className="text-sm text-fg-muted">
                        После апгрейда сможешь загружать треки. Чтобы новый JWT получил роль Artist —
                        перезайди после успеха.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="block w-64">
                            <span className="mb-1 block text-sm text-fg-muted">Сценическое имя (опционально)</span>
                            <input
                                type="text"
                                value={stageName}
                                onChange={(e) => setStageName(e.target.value)}
                                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                            />
                        </label>
                        <button
                            onClick={() => upgrade.mutate()}
                            disabled={upgrade.isPending}
                            className="rounded-md bg-accent px-4 py-2 text-accent-fg font-medium hover:opacity-90 disabled:opacity-50"
                        >
                            {upgrade.isPending ? 'Обновляем…' : 'Стать артистом'}
                        </button>
                    </div>
                    {upgrade.isSuccess && (
                        <p className="text-sm text-success">
                            Роль выдана. Перезайди, чтобы новый JWT включал её.{' '}
                            <button onClick={() => logout()} className="underline">
                                выйти сейчас
                            </button>
                        </p>
                    )}
                    {upgrade.isError && <p className="text-sm text-danger">Не получилось — попробуй позже.</p>}
                </section>
            )}

            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Активные сессии</h2>
                    {sessions.data && sessions.data.length > 1 && (
                        <button
                            onClick={() => revokeAllOthers.mutate()}
                            disabled={revokeAllOthers.isPending}
                            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated disabled:opacity-50"
                        >
                            Выйти на всех остальных устройствах
                        </button>
                    )}
                </div>

                {sessions.isLoading && <p className="text-sm text-fg-muted">Загружаем…</p>}
                {sessions.isError && <p className="text-sm text-danger">Не удалось загрузить.</p>}

                {sessions.data && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {sessions.data.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                                <div>
                                    <div className="font-medium">
                                        {s.deviceLabel}
                                        {s.isCurrent && (
                                            <span className="ml-2 rounded bg-success/20 px-2 py-0.5 text-xs text-success">
                                                текущая
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-fg-muted">
                                        {s.ipAddress ?? '—'} · {s.userAgent ?? '—'}
                                    </div>
                                    <div className="text-xs text-fg-muted">
                                        Создана {new Date(s.createdAt).toLocaleString('ru')}
                                        {s.lastUsedAt && (
                                            <> · последний вход {new Date(s.lastUsedAt).toLocaleString('ru')}</>
                                        )}
                                    </div>
                                </div>
                                {!s.isCurrent && (
                                    <button
                                        onClick={() => revoke.mutate(s.id)}
                                        disabled={revoke.isPending}
                                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated disabled:opacity-50"
                                    >
                                        Завершить
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}