import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { becomeArtist } from '@/shared/api/me';
import {
    createArtist,
    deleteArtistAvatar,
    deleteArtistBanner,
    getMyArtist,
    updateArtist,
    uploadArtistAvatar,
    uploadArtistBanner,
} from '@/shared/api/artists';
import { ImageUploader } from '@/features/cover/ImageUploader';

export function ArtistSettingsPage() {
    const qc = useQueryClient();
    const { logout } = useAuth();

    const artist = useQuery({
        queryKey: ['my-artist'],
        queryFn: getMyArtist,
    });

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [dirty, setDirty] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const [needsRelogin, setNeedsRelogin] = useState(false);

    const a = artist.data;

    useEffect(() => {
        if (a && !initialized) {
            setName(a.name);
            setBio(a.bio ?? '');
            setInitialized(true);
        }
    }, [a, initialized]);

    const save = useMutation({
        mutationFn: () => updateArtist(a!.id, { name: name.trim(), bio: bio.trim() }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-artist'] });
            qc.invalidateQueries({ queryKey: ['artist', a!.id] });
            setDirty(false);
        },
    });

    const create = useMutation({
        mutationFn: async (data: { name: string; bio?: string }) => {
            await becomeArtist(data.name);
            return await createArtist(data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-artist'] });
            setInitialized(false);
            setNeedsRelogin(true);
        },
    });

    if (artist.isLoading) return <p className="text-fg-muted">Загрузка...</p>;

    // Если профиль только что создан, показываем экран-заглушку
    if (needsRelogin) {
        return (
            <article className="mx-auto max-w-md space-y-6 text-center mt-10">
                <div className="rounded-md border border-success/40 bg-success/10 p-6">
                    <h1 className="text-2xl font-bold text-success mb-2">Профиль успешно создан!</h1>
                    <p className="text-sm text-fg-muted mb-6">
                        Чтобы получить полный доступ к функциям артиста,
                        необходимо обновить сессию.
                    </p>
                    <button
                        onClick={() => logout()}
                        className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                    >
                        Выйти и войти заново
                    </button>
                </div>
            </article>
        );
    }

    if (!a) {
        return (
            <article className="mx-auto max-w-md space-y-6">
                <h1 className="text-2xl font-bold">Профиль артиста</h1>
                <p className="text-sm text-fg-muted">У вас еще нет профиля артиста. Заполните данные, чтобы создать его.</p>
                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Имя / Псевдоним</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={200}
                        placeholder="Название..."
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Биография (необязательно)</span>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={4000}
                        rows={4}
                        placeholder="Напишите пару слов о себе..."
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>
                {create.isError && <p className="text-xs text-danger">Не удалось создать профиль.</p>}
                <button
                    onClick={() => create.mutate({ name: name.trim(), bio: bio.trim() || undefined })}
                    disabled={!name.trim() || create.isPending}
                    className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {create.isPending ? 'Создание...' : 'Создать профиль'}
                </button>
            </article>
        );
    }

    return (
        <article className="mx-auto max-w-2xl space-y-8">
            <h1 className="text-2xl font-bold">Настройки артиста</h1>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Баннер</h2>
                <p className="text-xs text-fg-muted">Рекомендуемый размер: 1500x500, не более 15 МБ</p>
                <ImageUploader
                    currentUrl={a.bannerUrl}
                    shape="banner"
                    label="Баннер"
                    onUpload={async (f) => {
                        await uploadArtistBanner(a.id, f);
                        qc.invalidateQueries({ queryKey: ['my-artist'] });
                        qc.invalidateQueries({ queryKey: ['artist', a.id] });
                    }}
                    onDelete={async () => {
                        await deleteArtistBanner(a.id);
                        qc.invalidateQueries({ queryKey: ['my-artist'] });
                        qc.invalidateQueries({ queryKey: ['artist', a.id] });
                    }}
                />
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Аватар</h2>
                <p className="text-xs text-fg-muted">Не более 10 МБ</p>
                <ImageUploader
                    currentUrl={a.avatarUrl}
                    shape="circle"
                    label="Аватар"
                    onUpload={async (f) => {
                        await uploadArtistAvatar(a.id, f);
                        qc.invalidateQueries({ queryKey: ['my-artist'] });
                        qc.invalidateQueries({ queryKey: ['artist', a.id] });
                    }}
                    onDelete={async () => {
                        await deleteArtistAvatar(a.id);
                        qc.invalidateQueries({ queryKey: ['my-artist'] });
                        qc.invalidateQueries({ queryKey: ['artist', a.id] });
                    }}
                />
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Имя артиста</h2>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setDirty(true); }}
                    maxLength={200}
                    className="w-full max-w-md rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Название..."
                />
            </section>

            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Биография</h2>
                <textarea
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                    maxLength={4000}
                    rows={6}
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Расскажите о себе..."
                />
                <p className="text-xs text-fg-muted">{bio.length}/4000</p>
            </section>

            <div className="flex gap-3">
                <button
                    onClick={() => save.mutate()}
                    disabled={!dirty || save.isPending}
                    className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {save.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
                {save.isSuccess && <span className="self-center text-xs text-fg-muted">Сохранено</span>}
                {save.isError && <span className="self-center text-xs text-danger">Ошибка сохранения</span>}
            </div>
        </article>
    );
}