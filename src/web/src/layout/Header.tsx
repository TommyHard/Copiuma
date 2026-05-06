import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { ThemeToggle } from '@/features/theme/ThemeToggle';

const ARTIST_PLUS = new Set(['Artist', 'Moderator', 'Admin', 1, 2, 3]);

export function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function onLogout() {
        await logout();
        navigate('/auth/login', { replace: true });
    }

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
                <NavItem to="/playlists">Плейлисты</NavItem>
                <NavItem to="/favorites">Избранное</NavItem>
                <NavItem to="/offline">Офлайн</NavItem>
                <NavItem to="/history">История</NavItem>
                <NavItem to="/friends">Друзья</NavItem>
                <NavItem to="/rooms">DJ-комнаты</NavItem>
                {user && ARTIST_PLUS.has(user.role) && <NavItem to="/upload">Загрузить</NavItem>}
            </nav>
            <div className="ml-auto flex items-center gap-2 text-sm">
                <ThemeToggle />
                {user && <NotificationsBell />}
                {user && (
                    <Link to={`/users/${user.id}`} className="hidden text-fg-muted hover:text-fg md:block">
                        {user.displayName ?? user.email}
                        {user.role !== 'User' && (
                            <span className="ml-2 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
                                {user.role}
                            </span>
                        )}
                        {!user.emailVerified && (
                            <span className="ml-2 rounded bg-danger/20 px-2 py-0.5 text-xs text-danger">
                                email не подтверждён
                            </span>
                        )}
                    </Link>
                )}
                {user && (
                    <Link
                        to="/artist/settings"
                        className="hidden rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:bg-bg-elevated md:block"
                        title="Настройки артиста"
                    >
                        🎤
                    </Link>
                )}
                <Link
                    to="/settings"
                    className="hidden rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated md:block"
                    title="Настройки профиля"
                >
                    ⚙️
                </Link>
                <button
                    onClick={onLogout}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-bg-elevated transition-colors">
                    Выйти
                </button>
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