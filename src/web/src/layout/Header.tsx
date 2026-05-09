import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { useUIStore } from '@/shared/store/uiStore';
import { useContextMenu, ContextMenuPortal, ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/ContextMenu';
import { Tooltip } from '@/shared/ui/Tooltip';
import { getPublicUserProfile } from '@/shared/api/profile';
import {
    UsersIcon,
    UserIcon,
    ClockIcon,
    UploadIcon,
    SettingsIcon,
    LogOutIcon,
    SearchIcon,
    CatalogIcon,
    ArtistSettingsIcon,
    HomeIcon
} from '@/shared/ui/icons';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { getMyArtist } from '@/shared/api/artists';

const ARTIST_PLUS = new Set(['Artist', 'Moderator', 'Admin', 1, 2, 3]);

const ROLE_LABELS: Record<string | number, string> = {
    'User': 'Пользователь',
    'Artist': 'Артист',
    'Moderator': 'Модератор',
    'Admin': 'Админ',
    0: 'Пользователь',
    1: 'Артист',
    2: 'Модератор',
    3: 'Админ'
};

export function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [searchValue, setSearchValue] = useState('');

    const { rightTab, setRightTab, isRightOpen, setRightOpen } = useUIStore();
    const { isOpen, position, onContextMenu, close } = useContextMenu();

    const profileQ = useQuery({
        queryKey: ['user-profile', user?.id],
        queryFn: () => getPublicUserProfile(user!.id),
        enabled: !!user?.id,
        staleTime: 5 * 60 * 1000,
    });
    const avatarUrl = profileQ.data?.avatarUrl ?? null;

    const myArtistQ = useQuery({
        queryKey: ['my-artist', user?.id],
        queryFn: getMyArtist,
        enabled: !!user?.id && ARTIST_PLUS.has(user.role),
        staleTime: 5 * 60 * 1000,
    });
    const artistId = myArtistQ.data?.id;

    const handleSearchEnter = () => {
        if (!searchValue.trim()) return;
        navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`);
        setSearchValue('');
    };

    const goToCatalog = () => {
        setSearchValue('');
        navigate('/search', { state: { scrollToCatalog: true } });
    };

    async function onLogout() {
        close();
        await logout();
        navigate('/auth/login', { replace: true });
    }

    const handleMenuClick = (path: string) => {
        navigate(path);
        close();
    };

    return (
        <header className="shrink-0 z-10 rounded-xl px-5 flex h-10 items-center">

            {/* LOGO */}
            <div className="flex-1 flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2 font-bold tracking-tight shrink-0">
                    <img
                        src="/favicon.svg"
                        alt="Copiuma"
                        className="size-10"
                    />
                    Copiuma
                </Link>
            </div>

            {/* SEARCH AND HOME LINK */}
            <div className="flex-1 hidden md:flex items-center justify-center gap-2">
                <Tooltip content="Главная" position="bottom">
                    <NavLink
                        to="/"
                        className={({ isActive }) =>
                            cn(
                                'p-3 rounded-full transition-colors flex items-center justify-center shrink-0',
                                isActive
                                    ? 'bg-accent/5 border border-border text-accent'
                                    : 'text-fg-muted hover:text-fg hover:bg-accent/10'
                            )
                        }
                    >
                        <HomeIcon className="w-7 h-7" />
                    </NavLink>
                </Tooltip>

                <div className="w-full max-w-xl flex items-center bg-bg rounded-full border border-border px-3 py-2 focus-within:border-accent/50 group transition-all">
                    <SearchIcon className="w-6 h-6 text-fg-muted group-focus-within:text-accent transition-colors" />
                    <input
                        type="text"
                        placeholder="Поиск..."
                        className="flex-1 bg-transparent outline-none border-none text-1xl px-2 text-fg"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchEnter()}
                    />

                    <div className="w-0.5 self-stretch bg-border mx-2" />

                    <Tooltip content="Каталог" position="bottom">
                        <button
                            onClick={goToCatalog}
                            className="p-1 text-fg-muted hover:text-accent transition-colors shrink-0"
                        >
                            <CatalogIcon className="w-6 h-6" />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* THEMES, BELL, FRIEND'S ACTIVITY, PROFILE */}
            <div className="flex-1 flex items-center justify-end gap-2 text-sm">
                <ThemeToggle />
                {user && <NotificationsBell />}

                {user && (
                    <>
                        <Tooltip content="Активность друзей" position="bottom">
                            <button
                                onClick={() => {
                                    if (!isRightOpen) setRightOpen(true);
                                    setRightTab(rightTab === 'friends' ? 'now-playing' : 'friends');
                                }}
                                className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    rightTab === 'friends' && isRightOpen
                                        ? "bg-accent text-accent-fg border-accent"
                                        : "border-border text-fg-muted hover:text-fg hover:bg-accent/20"
                                )}
                            >
                                <UsersIcon className="w-6 h-6" />
                            </button>
                        </Tooltip>

                        <button
                            onClick={onContextMenu}
                            className="relative flex items-center justify-center w-9 h-9 ml-1 rounded-full bg-bg border-2 border-accent hover:opacity-80 transition-opacity overflow-hidden shadow-[0_0_10px_rgba(202,162,230,0.1)]"
                        >
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt={user.displayName ?? "Аватар"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span className="text-sm font-bold uppercase text-accent">
                                    {user.displayName?.[0] || user.email[0]}
                                </span>
                            )}
                        </button>

                        <ContextMenuPortal isOpen={isOpen} position={position}>
                            <div className="px-3 py-3 flex flex-col items-center border-b border-border mb-1 min-w-[180px]">
                                <span className="text-sm font-bold text-fg truncate max-w-[160px]">
                                    {user.displayName ?? user.email}
                                </span>

                                {user.role !== 'User' && (
                                    <div className="mt-1.5 flex justify-center">
                                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-gradient-to-r from-accent/30 to-accent/10 border border-accent/40 text-[10px] font-bold text-accent uppercase tracking-widest shadow-[0_0_8px_rgba(202,162,230,0.15)]">
                                            {ROLE_LABELS[user.role] ?? user.role}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <ContextMenuItem icon={<UserIcon />} onClick={() => handleMenuClick(`/users/${user.id}`)}>
                                Профиль
                            </ContextMenuItem>

                            <ContextMenuItem icon={<ClockIcon />} onClick={() => handleMenuClick('/history')}>
                                История
                            </ContextMenuItem>

                            {ARTIST_PLUS.has(user.role) && (
                                <>
                                    <ContextMenuSeparator />

                                    {artistId && (
                                        <ContextMenuItem icon={<UserIcon />} onClick={() => handleMenuClick(`/artists/${artistId}`)}>
                                            Профиль артиста
                                        </ContextMenuItem>
                                    )}

                                    <ContextMenuItem icon={<ArtistSettingsIcon />} onClick={() => handleMenuClick('/artist/settings')}>
                                        Настройки артиста
                                    </ContextMenuItem>
                                    <ContextMenuItem icon={<UploadIcon />} onClick={() => handleMenuClick('/upload')}>
                                        Загрузить
                                    </ContextMenuItem>
                                </>
                            )}

                            <ContextMenuSeparator />

                            <ContextMenuItem icon={<SettingsIcon />} onClick={() => handleMenuClick('/settings')}>
                                Настройки
                            </ContextMenuItem>

                            <ContextMenuItem danger icon={<LogOutIcon />} onClick={onLogout}>
                                Выйти
                            </ContextMenuItem>
                        </ContextMenuPortal>
                    </>
                )}
            </div>
        </header>
    );
}