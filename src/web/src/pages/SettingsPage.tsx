import { useState, useEffect, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, changePassword } from '@/shared/api/profile';
import { listGenres } from '@/shared/api/genres';
import { cn } from '@/shared/lib/cn';

type Tab = 'profile' | 'password';

const LANGUAGES = [
    { value: 'ru', label: 'Русский' },
    { value: 'en', label: 'English' },
];

export function SettingsPage() {
    const [tab, setTab] = useState<Tab>('profile');

    return (
        <section className="space-y-6">
            <h1 className="text-2xl font-semibold">Настройки</h1>

            <div className="flex gap-4 border-b border-border text-sm">
                <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')}>Профиль</TabBtn>
                <TabBtn active={tab === 'password'} onClick={() => setTab('password')}>Смена пароля</TabBtn>
            </div>

            {tab === 'profile' && <ProfileSection />}
            {tab === 'password' && <PasswordSection />}
        </section>
    );
}

// Profile section

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

    if (profileQ.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (profileQ.isError) return <p className="text-danger">Не удалось загрузить профиль.</p>;

    return (
        <form onSubmit={onSubmit} className="max-w-md space-y-5">
            {/* Display name */}
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">Отображаемое имя</span>
                <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Как тебя зовут?"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                />
            </label>

            {/* Bio */}
            <label className="block">
                <span className="mb-1 block text-sm text-fg-muted">О себе</span>
                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Расскажите немного о себе…"
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <span className="text-xs text-fg-muted">{bio.length}/500</span>
            </label>

            {/* Language */}
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

            {/* Genres */}
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
                                    ×
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
                        placeholder="Добавить жанр…"
                        className="flex-1 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <button
                        type="button"
                        onClick={() => addGenre(genreInput)}
                        disabled={!genreInput.trim()}
                        className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-elevated disabled:opacity-40"
                    >
                        +
                    </button>
                </div>
                <datalist id="settings-genre-list">
                    {(genresQ.data ?? []).map((g) => <option key={g.slug} value={g.slug}>{g.displayName}</option>)}
                </datalist>
            </div>

            {save.isSuccess && (
                <p className="text-sm text-success">Профиль обновлён.</p>
            )}
            {save.isError && (
                <p className="text-sm text-danger">Не удалось сохранить. Попробуй позже.</p>
            )}

            <button
                type="submit"
                disabled={save.isPending}
                className="rounded-md bg-accent px-5 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
                {save.isPending ? 'Сохраняем…' : 'Сохранить'}
            </button>
        </form>
    );
}

// Password section

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
            setLocalError(e?.response?.data ?? 'Ошибка. Проверь текущий пароль.');
        },
    });

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        setLocalError('');
        if (next.length < 8) { setLocalError('Новый пароль должен быть не менее 8 символов.'); return; }
        if (next !== confirm) { setLocalError('Пароли не совпадают.'); return; }
        save.mutate();
    }

    return (
        <form onSubmit={onSubmit} className="max-w-md space-y-4">
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
                <span className="mb-1 block text-sm text-fg-muted">Повторить новый пароль</span>
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
            {save.isSuccess && <p className="text-sm text-success">Пароль успешно изменён.</p>}

            <button
                type="submit"
                disabled={save.isPending || !current || !next || !confirm}
                className="rounded-md bg-accent px-5 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
            >
                {save.isPending ? 'Меняем…' : 'Изменить пароль'}
            </button>
        </form>
    );
}

function TabBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                '-mb-px border-b-2 px-3 py-2 text-fg-muted hover:text-fg',
                active ? 'border-accent text-fg' : 'border-transparent',
            )}
        >
            {children}
        </button>
    );
}