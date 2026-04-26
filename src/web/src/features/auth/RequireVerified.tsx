import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { Link } from 'react-router-dom';

/**
 * Guard: пользователь залогинен, но email НЕ подтверждён -> показываем заглушку
 * с предложением подтвердить (и кнопку "отправить заново")
 */
export function RequireVerified({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    if (!user) return null;

    if (!user.emailVerified) {
        return (
            <div className="mx-auto max-w-md p-8 text-center">
                <h2 className="text-2xl font-semibold">Подтверди email</h2>
                <p className="mt-3 text-fg-muted">
                    Мы отправили ссылку на <span className="text-fg">{user.email}</span>. Перейди по ней,
                    чтобы получить доступ к функциям.
                </p>
                <Link
                    to="/auth/resend-verification"
                    className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-accent-fg hover:opacity-90"
                >
                    Отправить ссылку снова
                </Link>
            </div>
        );
    }

    return <>{children}</>;
}