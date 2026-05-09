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
import { cn } from '@/shared/lib/cn';
import { MusicIcon } from '@/shared/ui/icons';

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
    const [createError, setCreateError] = useState<string | null>(null);

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
            setCreateError(null);
            const newArtist = await createArtist(data);
            await becomeArtist(data.name);
            return newArtist;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['my-artist'] });
            setInitialized(false);
            setNeedsRelogin(true);
        },
        onError: (err: any) => {
            if (err?.response?.status === 409) {
                setCreateError("Это имя уже занято другим артистом. Пожалуйста, выберите другое.");
            } else {
                setCreateError(err?.response?.data?.message || "Произошла ошибка при создании профиля.");
            }
        }
    });

    if (artist.isLoading) {
        return (
            <div className="mx-auto max-w-4xl p-6 lg:p-10 flex justify-center items-center h-64 text-fg-muted font-medium animate-pulse">
                Загрузка данных артиста...
            </div>
        );
    }

    if (needsRelogin) {
        return (
            <div className="mx-auto max-w-xl p-6 lg:p-10 flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-full rounded-2xl border border-success/40 bg-success/5 p-8 text-center shadow-lg backdrop-blur-sm">
                    <div className="mx-auto size-16 rounded-full bg-success/20 text-success flex items-center justify-center mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-success mb-3 tracking-tight">Профиль успешно создан!</h1>
                    <p className="text-base text-fg-muted mb-8 max-w-sm mx-auto leading-relaxed">
                        Чтобы получить полный доступ к функциям артиста (загрузке треков, статистике и альбомам),
                        необходимо обновить вашу сессию.
                    </p>
                    <button
                        onClick={() => logout()}
                        className="rounded-lg bg-accent px-8 py-3 text-sm font-bold text-accent-fg hover:brightness-110 transition-all active:scale-95 shadow-sm"
                    >
                        Выйти и войти заново
                    </button>
                </div>
            </div>
        );
    }

    if (!a) {
        return (
            <div className="mx-auto max-w-3xl p-6 lg:p-10 mt-4 md:mt-10">
                <div className="text-center space-y-4 mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-accent/10 text-accent mb-2 shadow-sm border border-accent/20">
                        <MusicIcon className="w-10 h-10" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight">Создать профиль артиста</h1>
                    <p className="text-fg-muted max-w-md mx-auto text-base">
                        Делитесь своим творчеством со всем миром. Заполните начальные данные, чтобы получить доступ к загрузке треков.
                    </p>
                </div>

                <div className="bg-bg-elevated/40 border border-border rounded-2xl p-6 md:p-10 shadow-sm">
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-fg-muted uppercase ml-1">Имя или Псевдоним</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={200}
                                placeholder="Ваше сценическое имя"
                                className="w-full rounded border border-border bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-base"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-fg-muted uppercase ml-1">Биография (необязательно)</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                maxLength={4000}
                                rows={4}
                                placeholder="Напишите пару слов о себе..."
                                className="w-full rounded border border-border bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-base resize-none"
                            />
                        </div>

                        {createError && (
                            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
                                {createError}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                onClick={() => create.mutate({ name: name.trim(), bio: bio.trim() || undefined })}
                                disabled={!name.trim() || create.isPending}
                                className="w-full rounded-lg bg-accent px-6 py-3.5 text-base font-bold text-accent-fg hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 shadow-md"
                            >
                                {create.isPending ? 'Создание профиля...' : 'Создать профиль'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl p-6 lg:p-10">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Настройки артиста</h1>
                <p className="text-fg-muted mt-2 text-base">Управление вашим публичным профилем исполнителя.</p>
            </header>

            <div className="space-y-2">
                <SectionLayout
                    title="Визуальное оформление"
                    description="Аватар и баннер формируют уникальный стиль вашей страницы."
                >
                    <div className="space-y-8 bg-bg-elevated/40 p-6 rounded-xl border border-border">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-fg-muted uppercase">Баннер</span>
                                <span className="text-[10px] text-fg-muted">Рекомендуется: 1500x500 (до 15 МБ)</span>
                            </div>
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
                        </div>

                        <div className="h-px bg-border/50 w-full" />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-fg-muted uppercase">Аватар</span>
                                <span className="text-[10px] text-fg-muted">До 10 МБ</span>
                            </div>
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
                        </div>
                    </div>
                </SectionLayout>

                <SectionLayout
                    title="Основная информация"
                    description="Эти данные будут видны всем слушателям на вашей странице артиста."
                >
                    <div className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-fg-muted uppercase ml-1">Имя артиста</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setDirty(true); }}
                                maxLength={200}
                                className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                                placeholder="Ваше сценическое имя"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-xs font-bold text-fg-muted uppercase">Биография</label>
                                <span className="text-[10px] text-fg-muted">{bio.length}/4000</span>
                            </div>
                            <textarea
                                value={bio}
                                onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                                maxLength={4000}
                                rows={6}
                                className="w-full rounded border border-border bg-bg-elevated px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none"
                                placeholder="Расскажите о себе, своей музыке и планах..."
                            />
                        </div>

                        <div className="flex items-center gap-4 pt-2">
                            <button
                                onClick={() => save.mutate()}
                                disabled={!dirty || save.isPending}
                                className="rounded bg-accent px-6 py-2.5 text-sm font-bold text-accent-fg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {save.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                            </button>

                            {save.isSuccess && (
                                <span className="text-xs text-success font-bold animate-in fade-in slide-in-from-left-2">
                                    Успешно сохранено
                                </span>
                            )}
                            {save.isError && (
                                <span className="text-xs text-danger font-bold animate-in fade-in slide-in-from-left-2">
                                    Ошибка при сохранении
                                </span>
                            )}
                        </div>
                    </div>
                </SectionLayout>
            </div>
        </div>
    );
}