import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

const baseInputClass =
    'peer w-full rounded-md border bg-bg-elevated px-3 py-2.5 text-fg outline-none transition-colors';

const inputClass = `${baseInputClass} border-border focus:border-accent focus:ring-1 focus:ring-accent`;

const errorInputClass = `${baseInputClass} border-danger focus:border-danger focus:ring-1 focus:ring-danger`;

const btnPrimaryClass =
    'w-full rounded-md border border-black bg-white px-4 py-3 text-black font-medium ' +
    'transition-transform duration-200 hover:scale-[1.05] active:scale-100 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';

function extractError(err: unknown): string | null {
    const data = (err as any)?.response?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data.message === 'string') return data.message;
    return null;
}

function navigatorLabel(): string | undefined {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua)) return 'Safari';
    return undefined;
}

function Field({ label, htmlFor, children, iconRight }: { label: string; htmlFor: string; children: React.ReactNode; iconRight?: React.ReactNode }) {
    return (
        <div className="relative z-0 w-full mb-4">
            {children}
            <label
                htmlFor={htmlFor}
                className="absolute left-3 top-2.5 z-10 origin-[0] -translate-y-5 scale-75 transform text-sm text-fg-muted bg-bg-elevated px-3 duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-2.5 peer-focus:-translate-y-5 peer-focus:scale-75 peer-focus:text-accent pointer-events-none"
            >
                {label}
            </label>
            {iconRight && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center z-10">
                    {iconRight}
                </div>
            )}
        </div>
    );
}

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation() as { state?: { from?: { pathname?: string } } };

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean }>({});

    const clearErrors = () => {
        if (error || fieldErrors.email || fieldErrors.password) {
            setError(null);
            setFieldErrors({});
        }
    };

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldErrors({});

        const isEmailEmpty = !email.trim();
        const isPasswordEmpty = !password;

        if (isEmailEmpty || isPasswordEmpty) {
            setFieldErrors({ email: isEmailEmpty, password: isPasswordEmpty });
            setError('Пожалуйста, заполните все поля.');
            return;
        }

        setSubmitting(true);
        try {
            await login(email, password, navigatorLabel());
            const next = location.state?.from?.pathname ?? '/';
            navigate(next, { replace: true });
        } catch (err: unknown) {
            setFieldErrors({ email: true, password: true });
            setError(extractError(err) ?? 'Не удалось войти.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-center">Войдите, чтобы продолжить.</h1>

                {error && (
                    <div className="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-md flex items-center gap-2">
                        <svg className="w-5 h-5 text-danger shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-danger m-0">{error}</p>
                    </div>
                )}
            </header>

            <form onSubmit={onSubmit} className="space-y-4 mt-4" noValidate>
                <Field
                    label="Email"
                    htmlFor="email-input"
                    iconRight={
                        <svg className="w-5 h-5 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    }
                >
                    <input
                        id="email-input"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder=" "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={clearErrors}
                        className={`${fieldErrors.email ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <Field
                    label="Пароль"
                    htmlFor="password-input"
                    iconRight={
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="rounded-[2px] text-fg-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-4 focus:ring-offset-bg-elevated transition-colors"
                        >
                            <div className="relative w-5 h-5">
                                <svg
                                    className={`absolute inset-0 transition-all duration-300 ${showPassword ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <svg
                                    className={`absolute inset-0 transition-all duration-300 ${!showPassword ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.51-2.76M6.41 6.41A10.05 10.05 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.05 10.05 0 01-1.39 2.502M15 12a3 3 0 11-6 0M3 3l18 18" />
                                </svg>
                            </div>
                        </button>
                    }
                >
                    <input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        minLength={8}
                        placeholder=" "
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={clearErrors}
                        className={`${fieldErrors.password ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <div className="pt-6">
                    <button type="submit" disabled={submitting} className={btnPrimaryClass}>
                        {submitting ? 'Входим…' : 'Войти'}
                    </button>
                </div>
            </form>

            <div className="flex flex-col items-center gap-6 text-sm pt-2">
                <Link to="/auth/register" className="group text-fg-muted">
                    У вас нет аккаунта?{' '}
                    <span className="underline font-medium text-white group-hover:text-accent">
                        ЗАРЕГИСТРИРУЙТЕСЬ
                    </span>
                </Link>
                <Link to="/auth/forgot-password" className="text-white hover:text-accent hover:underline font-medium mt-4">
                    СБРОС ПАРОЛЯ
                </Link>
            </div>
        </div>
    );
}

export { Field, inputClass, btnPrimaryClass, extractError };