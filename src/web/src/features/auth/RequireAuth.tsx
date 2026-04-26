import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';
import type { ReactNode } from 'react';

/*
 * Guard: если не залогинен — редирект на /auth/login с возвратом сюда после успеха
 */
export function RequireAuth({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    const loc = useLocation();

    if (status === 'loading') return <CenteredLoader />;

    if (status !== 'authenticated') {
        return <Navigate to="/auth/login" state={{ from: loc }} replace />;
    }

    return <>{children}</>;
}

function CenteredLoader() {
    return (
        <div className="grid h-full place-items-center text-fg-muted">
            <div>Загрузка…</div>
        </div>
    );
}