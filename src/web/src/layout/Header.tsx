import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { ThemeToggle } from '@/features/theme/ThemeToggle';
import { useUIStore } from '@/shared/store/uiStore';
import { useContextMenu, ContextMenuPortal, ContextMenuItem, ContextMenuSeparator } from '@/shared/ui/ContextMenu';
import { Tooltip } from '@/shared/ui/Tooltip';
import { UsersIcon, UserIcon, ClockIcon, UploadIcon, SettingsIcon, LogOutIcon } from '@/shared/ui/icons';

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

    const { rightTab, setRightTab, isRightOpen, setRightOpen } = useUIStore();

    const { isOpen, position, onContextMenu, close } = useContextMenu();

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
        <header className="shrink-0 z-10 rounded-xl border border-border bg-bg-elevated px-5 flex h-14 items-center gap-6 shadow-sm">
            <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <div className="size-6 rounded-md bg-accent" aria-hidden />
                Copiuma
            </Link>

            <nav className="hidden items-center gap-4 text-sm md:flex">
                <NavItem to="/">Главная</NavItem>
                <NavItem to="/catalog">Каталог</NavItem>
                <NavItem to="/search">Поиск</NavItem>
                <NavItem to="/offline">Офлайн</NavItem>
                <NavItem to="/friends">Друзья</NavItem>
                <NavItem to="/rooms">DJ-комнаты</NavItem>
            </nav>

            <div className="ml-auto flex items-center gap-2 text-sm">
                <ThemeToggle />
                {user && <NotificationsBell />}

                {user && (
                    <>
                        {/* Кнопка "Активность друзей" */}
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
                                <UsersIcon className="w-5 h-5" />
                            </button>
                        </Tooltip>

                        {/* Кнопка AVATAR */}
                        <button
                            onClick={onContextMenu}
                            className="relative flex items-center justify-center w-9 h-9 ml-1 rounded-full bg-bg border-2 border-accent hover:opacity-80 transition-opacity overflow-hidden shadow-[0_0_10px_rgba(202,162,230,0.1)]"
                        >
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
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

                                {!user.emailVerified && (
                                    <span className="mt-2 rounded bg-danger/20 px-2 py-0.5 text-[10px] text-danger text-center">
                                        email не подтверждён
                                    </span>
                                )}
                            </div>

                            <ContextMenuItem icon={<UserIcon />} onClick={() => handleMenuClick(`/users/${user.id}`)}>
                                Профиль
                            </ContextMenuItem>

                            <ContextMenuItem icon={<ClockIcon />} onClick={() => handleMenuClick('/history')}>
                                История
                            </ContextMenuItem>

                            {ARTIST_PLUS.has(user.role) && (
                                <ContextMenuItem icon={<UploadIcon />} onClick={() => handleMenuClick('/upload')}>
                                    Загрузить
                                </ContextMenuItem>
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

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
    return (
        <NavLink
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
                cn('hover:text-fg transition-colors', isActive ? 'text-fg font-medium' : 'text-fg-muted')
            }
        >
            {children}
        </NavLink>
    );
}