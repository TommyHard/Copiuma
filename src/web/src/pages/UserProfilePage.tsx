import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPublicUserProfile, uploadUserAvatar, deleteUserAvatar } from '@/shared/api/profile';
import { useAuth } from '@/features/auth/useAuth';
import { ImageUploader } from '@/features/cover/ImageUploader';
import { FollowUserButton } from '@/features/follows/FollowUserButton';
import { useContextMenu, ContextMenuPortal, ContextMenuItem } from '@/shared/ui/ContextMenu';
import { TrashIcon } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';

export function UserProfilePage() {
    const { id } = useParams();
    const { user: me } = useAuth();
    const qc = useQueryClient();
    const contextMenu = useContextMenu();

    const profile = useQuery({
        queryKey: ['user-profile', id],
        queryFn: () => getPublicUserProfile(id!),
        enabled: !!id,
    });

    if (profile.isLoading) return <div className="p-8 text-fg-muted font-medium">Загружаем профиль…</div>;
    if (profile.isError || !profile.data) return <div className="p-8 text-danger font-medium">Пользователь не найден.</div>;

    const p = profile.data;
    const isMe = me?.id === p.id;

    const handleDeleteAvatar = async () => {
        await deleteUserAvatar();
        qc.invalidateQueries({ queryKey: ['user-profile', id] });
        contextMenu.close();
    };

    return (
        <div className="relative min-h-full pb-10">
            <div className="absolute inset-x-0 top-0 h-[350px] bg-gradient-to-b from-[#a78bfa]/40 via-[#a78bfa]/10 to-transparent pointer-events-none z-0" />

            <div className="relative z-10">
                {/* HEADER */}
                <header className="flex flex-col md:flex-row items-center md:items-end gap-6 px-8 pt-16 pb-6">
                    {isMe ? (
                        <div
                            className={cn(
                                "shrink-0 shadow-2xl rounded-full size-48 md:size-56 relative group cursor-pointer bg-bg-elevated",
                                "[&>div]:!w-full [&>div]:!h-full [&>div]:!m-0 [&>div]:!space-y-0",
                                "[&_button:first-child]:!w-full [&_button:first-child]:!h-full [&_button:first-child]:!border-0 [&_button:first-child]:!rounded-full [&_button:first-child]:!shadow-none"
                            )}
                            onContextMenu={(e) => {
                                if (p.avatarUrl) {
                                    contextMenu.onContextMenu(e);
                                }
                            }}
                        >
                            <ImageUploader
                                currentUrl={p.avatarUrl}
                                shape="circle"
                                label="Аватар"
                                onUpload={async (f) => {
                                    await uploadUserAvatar(f);
                                    qc.invalidateQueries({ queryKey: ['user-profile', id] });
                                }}
                            />

                            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                                <ContextMenuItem
                                    danger
                                    icon={<TrashIcon className="w-4 h-4" />}
                                    onClick={handleDeleteAvatar}
                                >
                                    Убрать
                                </ContextMenuItem>
                            </ContextMenuPortal>
                        </div>
                    ) : (
                        <div
                            className="size-48 md:size-56 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center shadow-2xl"
                            style={{ backgroundImage: p.avatarUrl ? `url('${p.avatarUrl}')` : undefined }}
                            aria-hidden
                        >
                            {!p.avatarUrl && (
                                <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-fg-muted">
                                    {p.displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col items-center md:items-start min-w-0 pb-2">
                        <span className="text-sm font-semibold tracking-wide text-fg-muted mb-1">
                            Профиль
                        </span>
                        <h1 className="text-5xl md:text-7xl lg:text-[80px] font-black tracking-tighter text-fg truncate w-full mb-4">
                            {p.displayName}
                        </h1>
                        <div className="flex items-center gap-2 text-sm font-medium text-fg-muted">
                            <span className="text-fg">{p.followers}</span> Подписчиков
                            {p.following > 0 && (
                                <>
                                    <span className="mx-1">•</span>
                                    <span className="text-fg">{p.following}</span> Подписок
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* ACTION BAR */}
                <div className="px-8 py-4 flex items-center gap-4 bg-black/5 backdrop-blur-md sticky top-0 z-20">
                    {!isMe && <FollowUserButton userId={p.id} />}

                    {isMe && (
                        <Tooltip content="Настройки" position="bottom">
                            <Link
                                to="/settings"
                                className="p-2 flex items-center justify-center rounded-full text-fg-muted hover:text-fg hover:bg-bg-elevated transition-colors"
                            >
                                <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </Link>
                        </Tooltip>
                    )}
                </div>

                <div className="px-8 mt-10 space-y-12">
                    {/* ТОП АРТИСТЫ */}
                    {p.topArtists.length > 0 && (
                        <section>
                            <div className="flex items-end justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-fg">Топ артисты</h2>
                                </div>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 [&::-webkit-scrollbar]:hidden snap-x">
                                {p.topArtists.map((a) => (
                                    <Link
                                        key={a.artistId}
                                        to={`/artists/${a.artistId}`}
                                        className="flex flex-col gap-4 w-[180px] p-4 rounded-xl hover:bg-fg/5 transition-all duration-200 group shrink-0 snap-start"
                                    >
                                        <div
                                            className="w-full aspect-square rounded-full bg-bg-elevated shadow-md flex items-center justify-center text-5xl font-bold text-fg-muted overflow-hidden relative bg-cover bg-center border border-border/50 group-hover:shadow-xl transition-shadow"
                                            style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                                        >
                                            {!a.avatarUrl && <span>{a.name.charAt(0).toUpperCase()}</span>}
                                        </div>
                                        <div className="w-full text-left">
                                            <div className="font-semibold text-fg text-base truncate">
                                                {a.name}
                                            </div>
                                            <div className="text-sm text-fg-muted mt-0.5">Артист</div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/50">
                        <div className="space-y-8">
                            {p.bio && (
                                <section>
                                    <h2 className="text-xl font-bold tracking-tight mb-3">О себе</h2>
                                    <p className="whitespace-pre-wrap text-sm text-fg-muted leading-relaxed">{p.bio}</p>
                                </section>
                            )}

                            {p.favoriteGenres.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-bold tracking-tight mb-3">Любимые жанры</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {p.favoriteGenres.map((g) => (
                                            <span key={g} className="rounded-full bg-bg-elevated px-4 py-1.5 text-xs font-semibold text-fg-muted">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        <section>
                            <h2 className="text-xl font-bold tracking-tight mb-3">Статистика за месяц</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <StatCard label="Часов" value={p.listeningHours.toFixed(1)} />
                                <StatCard label="Уникальных треков" value={String(p.uniqueTracksPlayed)} />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-black/10 backdrop-blur-md border border-white/10 p-5 shadow-lg">
            <div className="text-3xl font-black text-fg tracking-tight">{value}</div>
            <div className="text-xs text-fg-muted mt-2 font-semibold tracking-wide uppercase">{label}</div>
        </div>
    );
}