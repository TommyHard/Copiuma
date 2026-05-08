import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, changePassword } from '@/shared/api/profile';
import { listGenres } from '@/shared/api/genres';
import { listBlockedArtists, unblockArtist } from '@/shared/api/blocks';
import { listDislikes, undoDislikeTrack, undoDislikeArtist } from '@/shared/api/dislikes';
import { listSessions, revokeSession, revokeAllOtherSessions } from '@/shared/api/sessions';
import { becomeArtist } from '@/shared/api/me';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';

const LANGUAGES = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
];

const ROLE_LABELS: Record<string | number, string> = {
    'Artist': 'Артист',
    'Moderator': 'Модератор',
    'Admin': 'Админ',
    1: 'Артист',
    2: 'Модератор',
    3: 'Админ'
};

function SectionLayout({ title, description, children, className }: { title: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={cn("grid grid-cols-1 md:grid-cols-[240px_1fr] gap-x-12 gap-y-4 py-8 border-b border-border last:border-0", className)}>
            <div>
                <h2 className="text-base font-semibold text-fg">{title}</h2>
                {description && <div className="mt-1 text-sm text-fg-muted leading-relaxed">{description}</div>}
            </div>
            <div className="min-w-0">
                {children}
            </div>
        </section>
    );
}

export function SettingsPage() {
    const { user, refreshUser, logout } = useAuth();

    if (!user) return null;

    return (
        <div className="mx-auto max-w-4xl p-6 lg:p-10">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
                <p className="text-fg-muted mt-2">Персонализация вашего аккаунта и управление безопасностью.</p>
            </header>

            <div className="space-y-2">
                <SectionLayout
                    title="Аккаунт"
                    description="Основные сведения и статус вашей учетной записи."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-bg-elevated/40 p-4 rounded border border-border">
                        <div>
                            <span className="text-[11px] uppercase font-bold text-fg-muted tracking-wider">Email</span>
                            <p className="text-sm font-medium mt-0.5">{user.email}</p>
                        </div>
                        <div>
                            <span className="text-[11px] uppercase font-bold text-fg-muted tracking-wider">Роль</span>
                            <p className="mt-0.5"><span className="inline-flex items-center rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent border border-accent/20">{ROLE_LABELS[user.role] ?? user.role}</span></p>
                        </div>
                        <div>
                            <span className="text-[11px] uppercase font-bold text-fg-muted tracking-wider">Дата регистрации</span>
                            <p className="text-sm mt-0.5 text-fg-muted">{new Date(user.createdAt).toLocaleDateString('ru')}</p>
                        </div>
                        <div>
                            <span className="text-[11px] uppercase font-bold text-fg-muted tracking-wider">Верификация</span>
                            <p className={cn("text-sm mt-0.5 font-medium", user.emailVerified ? "text-success" : "text-danger")}>
                                {user.emailVerified ? 'Подтвержден' : 'Не подтвержден'}
                            </p>
                        </div>
                    </div>
                </SectionLayout>

                <SectionLayout
                    title="Профиль"
                    description="То, как вас видят другие участники сообщества."
                >
                    <ProfileEditForm />
                </SectionLayout>

                {(user.role === 'User' || user.role === 0) && (
                    <SectionLayout
                        title="Для творцов"
                        description="Станьте артистом, чтобы загружать свою музыку."
                    >
                        <ArtistUpgradeForm refreshUser={refreshUser} logout={logout} defaultName={user.displayName ?? ''} />
                    </SectionLayout>
                )}

                <SectionLayout
                    title="Безопасность"
                    description="Регулярно обновляйте пароль для защиты аккаунта."
                >
                    <PasswordForm />
                </SectionLayout>

                <SectionLayout
                    title="Сеансы"
                    description="Управление активными подключениями к вашему профилю."
                >
                    <SessionsList />
                </SectionLayout>

                <SectionLayout
                    title="Игнорируемые"
                    description="Артисты, которых вы решили полностью скрыть."
                >
                    <BlockedArtistsList />
                </SectionLayout>

                <SectionLayout
                    title="Не интересно"
                    description="Контент, исключенный из персональных рекомендаций."
                >
                    <DislikesList />
                </SectionLayout>
            </div>
        </div>
    );
}


function ProfileEditForm() {
    const qc = useQueryClient();
    const profileQ = useQuery({ queryKey: ['profile'], queryFn: getProfile });
    const genresQ = useQuery({ queryKey: ['genres'], queryFn: listGenres });

    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [language, setLanguage] = useState('ru');
    const [genres, setGenres] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
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

    const toggleGenre = (slug: string) => {
        if (genres.includes(slug)) {
            setGenres(genres.filter(g => g !== slug));
        } else {
            setGenres([...genres, slug]);
        }
    };

    const handleAddCustom = () => {
        const norm = searchQuery.trim().toLowerCase();
        if (norm && !genres.includes(norm)) {
            setGenres([norm, ...genres]);
        }
        setSearchQuery('');
    };

    if (profileQ.isLoading) return <div className="h-40 flex items-center justify-center text-sm text-fg-muted">Загрузка данных...</div>;

    const allGenres = genresQ.data ?? [];
    const filteredGenres = allGenres.filter(g =>
        g.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const customSelectedGenres = genres.filter(g => !allGenres.some(ag => ag.slug === g));

    return (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
            <div className="space-y-1.5">
                <label className="text-xs font-bold text-fg-muted uppercase ml-1">Публичное имя</label>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-bold text-fg-muted uppercase ml-1">Описание профиля</label>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none transition-all"
                />
                <div className="text-[10px] text-right text-fg-muted">{bio.length}/500</div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-bold text-fg-muted uppercase">Любимые жанры</label>
                    <span className="text-[10px] text-fg-muted">{genres.length} выбрано</span>
                </div>

                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (searchQuery.trim() && filteredGenres.length === 0) handleAddCustom();
                        }
                    }}
                    placeholder="Начните вводить для поиска..."
                    className="w-full rounded border border-border bg-bg-elevated px-4 py-2 text-sm outline-none focus:border-accent transition-all"
                />

                <div className="p-3 bg-bg-elevated/30 border border-border rounded max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50">
                    <div className="flex flex-wrap gap-2">

                        {customSelectedGenres.map(customSlug => (
                            <button
                                key={customSlug}
                                type="button"
                                onClick={() => toggleGenre(customSlug)}
                                className="bg-accent text-accent-fg border border-accent px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                                {customSlug} <span className="opacity-60">&times;</span>
                            </button>
                        ))}

                        {filteredGenres.map(g => {
                            const isSelected = genres.includes(g.slug);
                            return (
                                <button
                                    key={g.slug}
                                    type="button"
                                    onClick={() => toggleGenre(g.slug)}
                                    className={cn(
                                        "px-3 py-1.5 rounded text-xs font-medium transition-all active:scale-95",
                                        isSelected
                                            ? "bg-accent text-accent-fg border border-accent shadow-sm"
                                            : "bg-bg border border-border text-fg-muted hover:text-fg hover:border-fg-muted/60"
                                    )}
                                >
                                    {g.displayName}
                                </button>
                            );
                        })}

                        {searchQuery.trim() && !filteredGenres.some(g => g.slug.toLowerCase() === searchQuery.trim().toLowerCase() || g.displayName.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                            <button
                                type="button"
                                onClick={handleAddCustom}
                                className="px-3 py-1.5 rounded text-xs font-medium bg-bg border border-dashed border-accent text-accent hover:bg-accent/10 transition-colors"
                            >
                                Добавить "{searchQuery.trim()}"
                            </button>
                        )}
                    </div>

                    {filteredGenres.length === 0 && !searchQuery.trim() && customSelectedGenres.length === 0 && (
                        <p className="text-xs text-fg-muted text-center py-6">Жанры не найдены</p>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 pt-2">
                <button
                    type="submit"
                    disabled={save.isPending}
                    className="rounded bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
                >
                    {save.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
                {save.isSuccess && <span className="text-xs text-success font-bold animate-in fade-in slide-in-from-left-2">Изменения применены</span>}
            </div>
        </form>
    );
}

function ArtistUpgradeForm({ refreshUser, logout, defaultName }: { refreshUser: () => Promise<void>, logout: () => void, defaultName: string }) {
    const [stageName, setStageName] = useState(defaultName);
    const upgrade = useMutation({
        mutationFn: () => becomeArtist(stageName.trim() || undefined),
        onSuccess: async () => await refreshUser(),
    });

    return (
        <div className="p-4 bg-accent/5 border border-accent/10 rounded space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    placeholder="Псевдоним"
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="flex-1 rounded border border-border bg-bg px-4 py-2 outline-none focus:border-accent transition-all text-sm"
                />
                <button
                    onClick={() => upgrade.mutate()}
                    disabled={upgrade.isPending}
                    className="rounded bg-accent px-5 py-2 text-accent-fg text-sm font-bold hover:brightness-110 transition-all"
                >
                    Обновить роль
                </button>
            </div>
            {upgrade.isSuccess && (
                <p className="text-xs text-success font-medium">
                    Успех! <button onClick={() => logout()} className="underline decoration-success/30 hover:decoration-success">Выйдите и войдите снова</button>, чтобы права обновились.
                </p>
            )}
        </div>
    );
}

function PasswordForm() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [localError, setLocalError] = useState('');

    const save = useMutation({
        mutationFn: () => changePassword(current, next),
        onSuccess: () => { setCurrent(''); setNext(''); setConfirm(''); setLocalError(''); },
        onError: (e: any) => setLocalError(e?.response?.data ?? 'Ошибка смены пароля.'),
    });

    return (
        <form onSubmit={(e) => {
            e.preventDefault();
            if (next !== confirm) return setLocalError('Пароли не совпадают.');
            save.mutate();
        }} className="space-y-4">
            <input
                type="password" placeholder="Текущий пароль" value={current} onChange={(e) => setCurrent(e.target.value)}
                className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                    type="password" placeholder="Новый пароль" value={next} onChange={(e) => setNext(e.target.value)}
                    className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <input
                    type="password" placeholder="Подтвердите" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
            </div>
            <button
                type="submit"
                disabled={save.isPending || !current || !next}
                className="rounded bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
            >
                Обновить пароль
            </button>
            {localError && <p className="text-xs text-danger font-medium">{localError}</p>}
        </form>
    );
}

function SessionsList() {
    const qc = useQueryClient();
    const sessions = useQuery({ queryKey: ['sessions'], queryFn: listSessions });

    const revoke = useMutation({
        mutationFn: (id: string) => revokeSession(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    });

    if (sessions.isLoading) return <div className="animate-pulse h-20 bg-bg-elevated rounded" />;

    return (
        <div className="border border-border rounded overflow-hidden bg-bg-elevated/20">
            <ul className="divide-y divide-border">
                {sessions.data?.map((s) => (
                    <li key={s.id} className="p-4 flex items-center justify-between text-xs sm:text-sm">
                        <div className="min-w-0 pr-4">
                            <div className="font-bold truncate flex items-center gap-2">
                                {s.deviceLabel || 'Устройство'}
                                {s.isCurrent && <span className="rounded text-[12px] bg-success/20 text-success px-1.5 py-0.5">Текущая</span>}
                            </div>
                            <div className="text-fg-muted mt-0.5 truncate">{s.ipAddress} • {s.userAgent}</div>
                        </div>
                        {!s.isCurrent && (
                            <button onClick={() => revoke.mutate(s.id)} className="text-danger font-bold hover:underline underline-offset-4">Выйти</button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function BlockedArtistsList() {
    const qc = useQueryClient();
    const blocksQ = useQuery({ queryKey: ['blocked-artists'], queryFn: listBlockedArtists });
    const unblock = useMutation({
        mutationFn: (id: string) => unblockArtist(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-artists'] }),
    });

    if (!blocksQ.data?.length) return <p className="text-xs text-fg-muted">Черный список пуст.</p>;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {blocksQ.data.map(b => (
                <div key={b.artistId} className="p-3 border border-border rounded-xl bg-bg-elevated/40 flex flex-col items-center text-center">
                    <Link to={`/artists/${b.artistId}`} className="group flex flex-col items-center w-full cursor-pointer">
                        <div
                            className="w-12 h-12 rounded-full bg-cover bg-center border border-border mb-2 transition-transform group-hover:scale-105"
                            style={{ backgroundImage: `url(${b.avatarUrl})` }}
                        />
                        <div className="text-xs font-bold truncate w-full mb-2 group-hover:text-accent group-hover:underline transition-colors">
                            {b.name}
                        </div>
                    </Link>
                    <button
                        onClick={() => unblock.mutate(b.artistId)}
                        className="text-[10px] font-black uppercase text-fg-muted hover:text-accent transition-colors mt-auto"
                    >
                        Вернуть
                    </button>
                </div>
            ))}
        </div>
    );
}

function DislikesList() {
    const qc = useQueryClient();
    const dislikesQ = useQuery({ queryKey: ['dislikes'], queryFn: listDislikes });

    const undislikeTrack = useMutation({
        mutationFn: (id: string) => undoDislikeTrack(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dislikes'] }),
    });

    const undislikeArtist = useMutation({
        mutationFn: (id: string) => undoDislikeArtist(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['dislikes'] }),
    });

    if (!dislikesQ.data?.length) return <p className="text-xs text-fg-muted">Нет отметок «Не интересно».</p>;

    return (
        <div className="space-y-2">
            {dislikesQ.data.map(d => (
                <div key={`${d.targetType}-${d.targetId}`} className="flex items-center justify-between p-3 border border-border rounded-lg bg-bg-elevated/20 text-xs">
                    <div className="min-w-0 pr-4 flex-1">

                        {d.targetType === 'Track' ? (
                            <div className="flex flex-col">
                                <Link to={`/tracks/${d.targetId}`} className="truncate font-bold text-sm hover:text-accent hover:underline transition-colors">
                                    {d.title}
                                </Link>

                                <div className="text-xs text-fg-muted mt-0.5 truncate">
                                    {(d.artistId ? (
                                            <Link to={`/artists/${d.artistId}`} className="hover:text-fg hover:underline transition-colors">
                                                {d.artistName}
                                            </Link>
                                        ) : (
                                            <span>{d.artistName || 'Неизвестный исполнитель'}</span>
                                        )
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <Link to={`/artists/${d.targetId}`} className="truncate font-bold text-sm hover:text-accent hover:underline transition-colors">
                                    {d.title}
                                </Link>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mt-0.5">
                                    Артист
                                </div>
                            </div>
                        )}

                    </div>

                    <button
                        onClick={() => d.targetType === 'Track' ? undislikeTrack.mutate(d.targetId) : undislikeArtist.mutate(d.targetId)}
                        disabled={undislikeTrack.isPending || undislikeArtist.isPending}
                        className="text-fg-muted hover:text-fg font-black uppercase text-[10px] disabled:opacity-50 shrink-0"
                    >
                        Отмена
                    </button>
                </div>
            ))}
        </div>
    );
}