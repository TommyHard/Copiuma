import type { ReactNode } from 'react';
import type { UserRole } from '@/shared/types';
import { useAuth } from './useAuth';

const ORDER: Record<UserRole, number> = { User: 0, Artist: 1, Moderator: 2, Admin: 3 };

/**
 * Guard по роли: проверяет «не ниже чем указанная»
 * Используется внутри RequireAuth + RequireVerified.
 *
 * Если у пользователя роль ниже — показываем плейсхолдер
 */
export function RequireRole({ atLeast, children }: { atLeast: UserRole; children: ReactNode }) {
    const { user } = useAuth();
    if (!user) return null;

    if (ORDER[user.role] < ORDER[atLeast]) {
        return (
            <div className="mx-auto max-w-md p-8 text-center">
                <h2 className="text-2xl font-semibold">Недостаточно прав</h2>
                <p className="mt-3 text-fg-muted">
                    Эта страница требует роль <span className="text-fg">{atLeast}</span>. Текущая ваша роль —{' '}
                    <span className="text-fg">{user.role}</span>.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}