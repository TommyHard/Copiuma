import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

export function HomePage() {
    const { user } = useAuth();

    return (
        <section className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight">
                Привет, {user?.displayName ?? user?.email ?? 'друг'}.
            </h1>

            {!user?.emailVerified && (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
                    Email пока не подтверждён. До подтверждения доступ к большинству функций ограничен.{' '}
                    <Link to="/auth/resend-verification" className="underline">
                        отправить ссылку снова
                    </Link>
                </div>
            )}

            <div className="rounded-md border border-border bg-bg-elevated p-6 text-fg-muted">
                Каталог треков и плеер появятся в следующей Update
            </div>
        </section>
    );
}