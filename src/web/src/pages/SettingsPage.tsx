import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, changePassword } from '@/shared/api/profile';
import { listGenres } from '@/shared/api/genres';
import { listBlockedArtists, unblockArtist } from '@/shared/api/blocks';
import { listDislikes, undoDislikeTrack, undoDislikeArtist } from '@/shared/api/dislikes';
import { listSessions, revokeSession, revokeAllOtherSessions } from '@/shared/api/sessions';
import { cn } from '@/shared/lib/cn';

type Tab = 'profile' | 'security' | 'blacklist';

const LANGUAGES = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
];

export function SettingsPage() {
    const [tab, setTab] = useState<Tab>('profile');

    return (
        <section className="space-y-6">
            <h1 className="text-2xl font-semibold">Настройки</h1>

            <div className="flex gap-4 border-b border-border text-sm overflow-x-auto">
                <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')}>Профиль</TabBtn>
                <TabBtn active={tab === 'security'} onClick={() => setTab('security')}>Безопасность</TabBtn>
                <TabBtn active={tab === 'blacklist'} onClick={() => setTab('blacklist')}>Рекомендации</TabBtn>
            </div>

            {tab === 'profile' && <ProfileSection />}
            {tab === 'security' && (
                <div className="space-y-10 max-w-2xl">
                    <PasswordSection />
                    <SessionsSection />
                </div>
            )}
            {tab === 'blacklist' && <BlacklistSection />}
        </section>
    );
}

function SessionsSection() {
    const qc = useQueryClient();
    const sessions = useQuery({ queryKey: ['sessions'], queryFn: listSessions });

    const revoke = useMutation({
        mutationFn: (id: string) => revokeSession(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    });

    const revokeAllOthers = useMutation({
        mutationFn: () => revokeAllOtherSessions(),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    });

    if (sessions.isLoading) return <p className="text-sm text-fg-muted">Загрузка сессий...</p>;
    if (sessions.isError) return <p className="text-sm text-danger">Ошибка загрузки сессий.</p>;

    return (
        <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Активные сеансы</h2>
                    <p className="text-sm text-fg-muted">Список устройств, с которых выполнен вход в ваш аккаунт.</p>
                </div>
                {sessions.data && sessions.data.length > 1 && (
                    <button
                        onClick={() => {
                            if (confirm('Выйти со всех других устройств?')) revokeAllOthers.mutate();
                        }}
                        disabled={revokeAllOthers.isPending}
                        className="rounded-md border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                        Завершить другие
                    </button>
                )}
            </div>

            {sessions.data && (
                <ul className="divide-y divide-border rounded-md border border-border bg-bg-elevated/30">
                    {sessions.data.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-4 p-4 text-sm hover:bg-bg-elevated/50 transition-colors">
                            <div>
                                <div className="font-medium">
                                    {s.deviceLabel || 'Неизвестное устройство'}
                                    {s.isCurrent && (
                                        <span className="ml-2 rounded bg-success/20 px-2 py-0.5 text-[10px] text-success uppercase font-bold tracking-wider">
                                            Текущий сеанс
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-fg-muted mt-1">
                                    {s.ipAddress ?? 'Неизвестный IP'} • {s.userAgent ?? 'Неизвестный браузер'}
                                </div>
                                <div className="text-xs text-fg-muted mt-0.5">
                                    Вход: {new Date(s.createdAt).toLocaleString('ru')}
                                    {s.lastUsedAt && ` • Активность: ${new Date(s.lastUsedAt).toLocaleString('ru')}`}
                                </div>
                            </div>
                            {!s.isCurrent && (
                                <button
                                    onClick={() => revoke.mutate(s.id)}
                                    disabled={revoke.isPending}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated disabled:opacity-50"
                                >
                                    Выйти
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function BlacklistSection() {
    const qc = useQueryClient();

    const blocksQ = useQuery({ queryKey: ['blocked-artists'], queryFn: listBlockedArtists });
    const dislikesQ = useQuery({ queryKey: ['dislikes'], queryFn: listDislikes });

    const unblock = useMutation({
        mutationFn: (artistId: string) => unblockArtist(artistId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['blocked-artists'] });
            qc.invalidateQueries({ queryKey: ['artist'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
        },
    });

    const undislikeTrack = useMutation({
        mutationFn: (trackId: string) => undoDislikeTrack(trackId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dislikes'] });
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
        },
    });

    const undislikeArtist = useMutation({
        mutationFn: (artistId: string) => undoDislikeArtist(artistId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['dislikes'] });
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
        },
    });

    return (
        <div className="space-y-10 max-w-4xl">
            {/* ЗАБЛОКИРОВАННЫЕ АРТИСТЫ */}
            <section className="space-y-4">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-danger">Заблокированные артисты</h2>
                    <p className="text-sm text-fg-muted">Эти артисты и их контент полностью исключены из вашей библиотеки.</p>
                </div>

                {blocksQ.isLoading && <p className="text-sm text-fg-muted">Загрузка...</p>}
                {blocksQ.data && blocksQ.data.length === 0 && <p className="text-sm text-fg-muted">Список пуст.</p>}

                {blocksQ.data && blocksQ.data.length > 0 && (
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {blocksQ.data.map(b => (
                            <li key={b.artistId} className="flex flex-col border border-border bg-bg-elevated rounded-md p-4 hover:bg-bg-elevated/70 transition-colors">
                                <Link
                                    to={`/artists/${b.artistId}`}
                                    className="flex flex-col items-center group mb-3"
                                >
                                    <div
                                        className="aspect-square w-full max-w-[120px] rounded-full bg-bg bg-cover bg-center flex items-center justify-center text-3xl font-bold text-fg-muted shadow-sm mb-3"
                                        style={{ backgroundImage: b.avatarUrl ? `url('${b.avatarUrl}')` : undefined }}
                                        aria-hidden={!!b.avatarUrl}
                                    >
                                        {!b.avatarUrl && b.name ? b.name.charAt(0).toUpperCase() : null}
                                    </div>
                                    <span className="font-medium text-sm text-center truncate w-full group-hover:underline">
                                        {b.name}
                                    </span>
                                </Link>

                                <button
                                    onClick={() => unblock.mutate(b.artistId)}
                                    disabled={unblock.isPending}
                                    className="mt-auto w-full rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:bg-bg hover:border-accent hover:text-accent transition-colors disabled:opacity-50"
                                >
                                    Разблокировать
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* НЕ ИНТЕРЕСНО */}
            <section className="space-y-4 pt-4 border-t border-border">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Не интересно</h2>
                    <p className="text-sm text-fg-muted">Эти треки не появляются в ваших персональных подборках.</p>
                </div>

                {dislikesQ.isLoading && <p className="text-sm text-fg-muted">Загрузка...</p>}
                {dislikesQ.data && dislikesQ.data.length === 0 && <p className="text-sm text-fg-muted">Список пуст.</p>}

                {dislikesQ.data && dislikesQ.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border bg-bg-elevated/30">
                        {dislikesQ.data.map(d => (
                            <li key={`${d.targetType}-${d.targetId}`} className="flex items-center justify-between gap-4 p-3 hover:bg-bg-elevated/50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    {d.targetType === 'Track' ? (
                                        <>
                                            <Link
                                                to={`/tracks/${d.targetId}`}
                                                className="font-medium text-sm truncate hover:text-accent hover:underline block"
                                            >
                                                {d.title}
                                            </Link>
                                            <div className="text-xs text-fg-muted mt-0.5">
                                                {d.artistId ? (
                                                    <Link to={`/artists/${d.artistId}`} className="hover:text-fg hover:underline">
                                                        {d.artistName ?? 'Неизвестный исполнитель'}
                                                    </Link>
                                                ) : (
                                                    <span>{d.artistName ?? 'Неизвестный исполнитель'}</span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Link
                                                to={`/artists/${d.targetId}`}
                                                className="font-medium text-sm truncate hover:text-accent hover:underline block"
                                            >
                                                {d.title}
                                            </Link>
                                            <div className="text-xs text-fg-muted mt-0.5">Артист</div>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => d.targetType === 'Track' ? undislikeTrack.mutate(d.targetId) : undislikeArtist.mutate(d.targetId)}
                                    disabled={undislikeTrack.isPending || undislikeArtist.isPending}
                                    className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated disabled:opacity-50"
                                >
                                    Восстановить
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

function ProfileSection() {
    const qc = useQueryClient();
    const profileQ = useQuery({
        queryKey: ['profile'],
        queryFn: getProfile,
    });
    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
    });

    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [language, setLanguage] = useState('ru');
    const [genres, setGenres] = useState<string[]>([]);
    const [genreInput, setGenreInput] = useState('');
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        if (profileQ.data && !synced) {
            setDisplayName(profileQ.data.displayName ?? '');
            setBio(profileQ.data.bio ?? '');
            setLanguage(profileQ.data.language ?? 'ru');
            setGenres(profileQ.data.favoriteGenres ?? []);
            setSynced(true);
        }
    }, [profileQ.data, synced]);

    const save = useMutation({
        mutationFn: () => updateProfile({
            displayName: displayName.trim() || undefined,
            bio: bio.trim(),
            favoriteGenres: genres,
            language,
        }),
        onSuccess: (data) => {
            qc.setQueryData(['profile'], data);
            qc.invalidateQueries({ queryKey: ['me'] });
        },
    });

    function addGenre(g: string) {
        const norm = g.trim().toLowerCase();
        if (norm && !genres.includes(norm)) setGenres([...genres, norm]);
        setGenreInput('');
    }

    function removeGenre(g: string) {
        setGenres(genres.filter((x) => x !== g));
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        save.mutate();
    }

    if (profileQ.isLoading) return <p className="text-fg-muted">Загрузка...</p>;
    if (profileQ.isError) return <p className="text-danger">Ошибка загрузки профиля.</p>;

    return (
        <form onSubmit={onSubmit} className="max-w-md space-y-5">
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Имя</span>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                />
            </label>

            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">О себе</span>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Пара слов о вас..."
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <span className="text-xs text-fg-muted">{bio.length}/500</span>
            </label>

            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Язык</span>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                >
                    {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                </select>
            </label>

            <div>
                <span className="mb-1 block text-sm text-fg-muted">Любимые жанры</span>
                {genres.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                        {genres.map((g) => (
                            <span
                                key={g}
                                className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs"
                            >
                                {g}
                                <button
                                    type="button"
                                    onClick={() => removeGenre(g)}
                                    className="leading-none text-fg-muted hover:text-danger"
                                >
                                    &times;
                                </button>
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex gap-2">
                    <input
                        list="settings-genre-list"
                        value={genreInput}
                        onChange={(e) => setGenreInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGenre(genreInput); } }}
                        placeholder="Например, rock"
                        className="flex-1 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <button
                        type="button"
                        onClick={() => addGenre(genreInput)}
                        disabled={!genreInput.trim()}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated disabled:opacity-40"
                    >
                        Добавить
                    </button>
                </div>
                <datalist id="settings-genre-list">
                    {(genresQ.data ?? []).map((g) => <option key={g.slug} value={g.slug}>{g.displayName}</option>)}
                </datalist>
            </div>

            {save.isSuccess && (
                <p className="text-sm text-success">Сохранено.</p>
            )}
            {save.isError && (
                <p className="text-sm text-danger">Ошибка при сохранении.</p>
            )}

            <button
                type="submit"
                disabled={save.isPending}
                className="rounded-md bg-accent px-5 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
                {save.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
        </form>
    );
}

function PasswordSection() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [localError, setLocalError] = useState('');

    const save = useMutation({
        mutationFn: () => changePassword(current, next),
        onSuccess: () => {
            setCurrent(''); setNext(''); setConfirm(''); setLocalError('');
        },
        onError: (e: any) => {
            setLocalError(e?.response?.data ?? 'Ошибка смены пароля.');
        },
    });

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        setLocalError('');
        if (next.length < 8) { setLocalError('Минимум 8 символов.'); return; }
        if (next !== confirm) { setLocalError('Пароли не совпадают.'); return; }
        save.mutate();
    }

    return (
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
            <div>
                <h2 className="text-lg font-semibold">Смена пароля</h2>
            </div>
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Текущий пароль</span>
                <input
                    type="password"
                    required
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                />
            </label>
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Новый пароль</span>
                <input
                    type="password"
                    required
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                />
            </label>
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Повторите новый пароль</span>
                <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                />
            </label>

            {localError && <p className="text-sm text-danger">{localError}</p>}
            {save.isSuccess && <p className="text-sm text-success">Пароль изменён.</p>}

            <button
                type="submit"
                disabled={save.isPending || !current || !next || !confirm}
                className="rounded-md bg-accent px-5 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
                {save.isPending ? 'Смена...' : 'Сменить пароль'}
            </button>
        </form>
    );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                '-mb-px border-b-2 px-3 py-2 text-fg-muted hover:text-fg whitespace-nowrap',
                active ? 'border-accent text-fg' : 'border-transparent',
            )}
        >
            {children}
        </button>
    );
}