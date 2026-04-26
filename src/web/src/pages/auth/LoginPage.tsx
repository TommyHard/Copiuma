import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation() as { state?: { from?: { pathname?: string } } };

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await login(email, password, navigatorLabel());
            const next = location.state?.from?.pathname ?? '/';
            navigate(next, { replace: true });
        } catch (err: unknown) {
            setError(extractError(err) ?? 'Не удалось войти.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Вход</h1>
                <p className="mt-1 text-sm text-fg-muted">Используй email и пароль.</p>
            </header>

            <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Email">
                    <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                    />
                </Field>

                <Field label="Пароль">
                    <input
                        type="password"
                        autoComplete="current-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                    />
                </Field>

                {error && <p className="text-sm text-danger">{error}</p>}

                <button type="submit" disabled={submitting} className={btnPrimaryClass}>
                    {submitting ? 'Входим…' : 'Войти'}
                </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link to="/auth/forgot-password" className="text-accent hover:underline">
                    Забыл пароль?
                </Link>
                <Link to="/auth/register" className="text-fg-muted hover:text-fg">
                    Регистрация
                </Link>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm text-fg-muted">{label}</span>
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-fg outline-none ' +
    'focus:border-accent focus:ring-1 focus:ring-accent';

const btnPrimaryClass =
    'w-full rounded-md bg-accent px-4 py-2 text-accent-fg font-medium hover:opacity-90 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

function navigatorLabel(): string | undefined {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return undefined;
}

function extractError(err: unknown): string | null {
    const data = (err as any)?.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data.message === 'string') return data.message;
    return null;
}

export { Field, inputClass, btnPrimaryClass, extractError };