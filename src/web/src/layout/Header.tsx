import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';

export function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function onLogout() {
        await logout();
        navigate('/auth/login', { replace: true });
    }

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
                <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
                    <div className="size-6 rounded-md bg-accent" aria-hidden />
                    Copiuma
                </Link>

                <nav className="hidden items-center gap-4 text-sm md:flex">
                    <NavItem to="/">Главная</NavItem>
                    <NavItem to="/me">Профиль</NavItem>
                </nav>

                <div className="ml-auto flex items-center gap-3 text-sm">
                    {user && (
                        <span className="hidden text-fg-muted md:block">
                            {user.displayName ?? user.email}
                            {user.role !== 'User' && <RoleBadge role={user.role} />}
                            {!user.emailVerified && <UnverifiedBadge />}
                        </span>
                    )}
                    <button onClick={onLogout} className="rounded-md border border-border px-3 py-1.5 hover:bg-bg-elevated">
                        Выйти
                    </button>
                </div>
            </div>
        </header>
    );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
    return (
        <NavLink
            to={to}
            end
            className={({ isActive }) =>
                cn('hover:text-fg', isActive ? 'text-fg' : 'text-fg-muted')
            }
        >
            {children}
        </NavLink>
    );
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className="ml-2 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">{role}</span>
    );
}

function UnverifiedBadge() {
    return (
        <span className="ml-2 rounded bg-danger/20 px-2 py-0.5 text-xs text-danger">
            email не подтверждён
        </span>
    );
}