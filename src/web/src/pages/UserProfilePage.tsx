import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicUserProfile, uploadUserAvatar, deleteUserAvatar } from '@/shared/api/profile';
import { useAuth } from '@/features/auth/useAuth';
import { ImageUploader } from '@/features/cover/ImageUploader';
import { FollowUserButton } from '@/features/follows/FollowUserButton';

export function UserProfilePage() {
    const { id } = useParams();
    const { user: me } = useAuth();
    const qc = useQueryClient();

    const profile = useQuery({
        queryKey: ['user-profile', id],
        queryFn: () => getPublicUserProfile(id!),
        enabled: !!id,
    });

    if (profile.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (profile.isError || !profile.data) return <p className="text-danger">Пользователь не найден.</p>;

    const p = profile.data;
    const isMe = me?.id === p.id;

    return (
        <article className="mx-auto max-w-2xl space-y-8">
            {/* Header */}
            <header className="flex items-start gap-5">
                {isMe ? (
                    <ImageUploader
                        currentUrl={p.avatarUrl}
                        shape="circle"
                        label="Аватар"
                        onUpload={async (f) => {
                            await uploadUserAvatar(f);
                            qc.invalidateQueries({ queryKey: ['user-profile', id] });
                        }}
                        onDelete={async () => {
                            await deleteUserAvatar();
                            qc.invalidateQueries({ queryKey: ['user-profile', id] });
                        }}
                    />
                ) : (
                    <div
                        className="size-24 rounded-full border-4 border-bg bg-bg-elevated bg-cover bg-center shadow-md md:size-32"
                        style={{ backgroundImage: p.avatarUrl ? `url('${p.avatarUrl}')` : undefined }}
                        aria-hidden
                    />
                )}

                <div className="space-y-2 pt-2">
                    <h1 className="text-2xl font-bold tracking-tight">{p.displayName}</h1>

                    <div className="flex flex-wrap gap-4 text-sm text-fg-muted">
                        <span>{p.followers} подписчиков</span>
                        <span>{p.following} подписок</span>
                    </div>

                    {!isMe && <FollowUserButton userId={p.id} />}
                    {isMe && (
                        <Link
                            to="/settings"
                            className="inline-block rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated"
                        >
                            Редактировать профиль
                        </Link>
                    )}
                </div>
            </header>

            {/* Bio */}
            {p.bio && (
                <section className="space-y-1">
                    <h2 className="text-lg font-semibold">О себе</h2>
                    <p className="whitespace-pre-wrap text-sm text-fg-muted">{p.bio}</p>
                </section>
            )}

            {/* Любимые жанры */}
            {p.favoriteGenres.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-lg font-semibold">Любимые жанры</h2>
                    <div className="flex flex-wrap gap-2">
                        {p.favoriteGenres.map((g) => (
                            <span
                                key={g}
                                className="rounded-full bg-bg-elevated px-3 py-1 text-xs text-fg-muted"
                            >
                                {g}
                            </span>
                        ))}
                    </div>
                </section>
            )}

            {/* Статистика */}
            <section className="space-y-2">
                <h2 className="text-lg font-semibold">Статистика за месяц</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <StatCard label="Часов" value={p.listeningHours.toFixed(1)} />
                    <StatCard label="Уникальных треков" value={String(p.uniqueTracksPlayed)} />
                    <StatCard label="Подписчиков" value={String(p.followers)} />
                </div>
            </section>

            {/* Топ артисты */}
            {p.topArtists.length > 0 && (
                <section className="space-y-2">
                    <h2 className="text-lg font-semibold">Топ артисты</h2>
                    <ul className="space-y-1">
                        {p.topArtists.map((a, i) => (
                            <li key={a.artistId} className="text-sm">
                                <span className="mr-2 text-fg-muted">{i + 1}.</span>
                                <Link to={`/artists/${a.artistId}`} className="text-accent hover:underline">
                                    {a.name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </article>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-border bg-bg-elevated p-3 text-center">
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-fg-muted">{label}</div>
        </div>
    );
}