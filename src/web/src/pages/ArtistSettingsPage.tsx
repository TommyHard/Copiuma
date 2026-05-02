import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

    const artist = useQuery({
        queryKey: ['my-artist'],
        queryFn: getMyArtist,
    });

    const [name, setName] = useState('');
    const [bio, setBio] = useState('');
    const [dirty, setDirty] = useState(false);
    const [initialized, setInitialized] = useState(false);

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
        onSuccess: (updated) => {
            qc.setQueryData(['my-artist'], updated);
            qc.setQueryData(['artist', a!.id], updated);
            setDirty(false);
        },
    });

    const create = useMutation({
        mutationFn: (data: { name: string; bio?: string }) => createArtist(data),
        onSuccess: (created) => {
            qc.setQueryData(['my-artist'], created);
            setInitialized(false);
        },
    });

    if (artist.isLoading) return <p className="text-fg-muted">Загружаем…</p>;

    // Если артиста нет — форма создания
    if (!a) {
        return (
            <article className="mx-auto max-w-md space-y-6">
                <h1 className="text-2xl font-bold">Создать профиль артиста</h1>
                <p className="text-sm text-fg-muted">
                    Заполните имя, чтобы создать свой профиль артиста. После этого вы сможете настроить баннер, аватар и описание.
                </p>
                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Имя артиста</span>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={200}
                        placeholder="Ваше имя или псевдоним"
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>
                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">О себе (необязательно)</span>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        maxLength={4000}
                        rows={4}
                        placeholder="Расскажите о себе…"
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                </label>
                {create.isError && <p className="text-xs text-danger">Не удалось создать. Возможно, имя уже занято.</p>}
                <button
                    onClick={() => create.mutate({ name: name.trim(), bio: bio.trim() || undefined })}
                    disabled={!name.trim() || create.isPending}
                    className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {create.isPending ? 'Создаём…' : 'Создать профиль'}
                </button>
            </article>
        );
    }

    return (
        <article className="mx-auto max-w-2xl space-y-8">
            <h1 className="text-2xl font-bold">Настройки профиля артиста</h1>

            {/* Banner */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Баннер</h2>
                <p className="text-xs text-fg-muted">Рекомендуемый размер: 1500×500, до 15 МБ</p>
                <ImageUploader
                    currentUrl={a.bannerUrl}
                    shape="banner"
                    label="Баннер"
                    onUpload={async (f) => {
                        const updated = await uploadArtistBanner(a.id, f);
                        qc.setQueryData(['my-artist'], updated);
                        qc.setQueryData(['artist', a.id], updated);
                    }}
                    onDelete={async () => {
                        const updated = await deleteArtistBanner(a.id);
                        qc.setQueryData(['my-artist'], updated);
                        qc.setQueryData(['artist', a.id], updated);
                    }}
                />
            </section>

            {/* Avatar */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Аватар</h2>
                <p className="text-xs text-fg-muted">Квадратное изображение, до 10 МБ</p>
                <ImageUploader
                    currentUrl={a.avatarUrl}
                    shape="circle"
                    label="Аватар"
                    onUpload={async (f) => {
                        const updated = await uploadArtistAvatar(a.id, f);
                        qc.setQueryData(['my-artist'], updated);
                        qc.setQueryData(['artist', a.id], updated);
                    }}
                    onDelete={async () => {
                        const updated = await deleteArtistAvatar(a.id);
                        qc.setQueryData(['my-artist'], updated);
                        qc.setQueryData(['artist', a.id], updated);
                    }}
                />
            </section>

            {/* Name */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Имя артиста</h2>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setDirty(true); }}
                    maxLength={200}
                    className="w-full max-w-md rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Введите имя…"
                />
            </section>

            {/* Bio */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Об артисте</h2>
                <textarea
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                    maxLength={4000}
                    rows={6}
                    className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                    placeholder="Расскажите о себе…"
                />
                <p className="text-xs text-fg-muted">{bio.length}/4000</p>
            </section>

            {/* Save */}
            <div className="flex gap-3">
                <button
                    onClick={() => save.mutate()}
                    disabled={!dirty || save.isPending}
                    className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {save.isPending ? 'Сохраняем…' : 'Сохранить'}
                </button>
                {save.isSuccess && <span className="self-center text-xs text-fg-muted">Сохранено ✓</span>}
                {save.isError && <span className="self-center text-xs text-danger">Ошибка сохранения</span>}
            </div>
        </article>
    );
}