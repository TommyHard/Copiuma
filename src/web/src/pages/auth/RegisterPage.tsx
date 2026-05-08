import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { register } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

const baseInputClass =
    'peer w-full rounded-md border bg-bg-elevated px-3 py-2.5 text-fg outline-none transition-colors';
const errorInputClass = `${baseInputClass} border-danger focus:border-danger focus:ring-1 focus:ring-danger`;

export function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{ email?: boolean; password?: boolean; displayName?: boolean }>({});

    const clearErrors = () => {
        if (error || fieldErrors.email || fieldErrors.password || fieldErrors.displayName) {
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
        const isNameEmpty = !displayName.trim();

        if (isEmailEmpty || isPasswordEmpty || isNameEmpty) {
            setFieldErrors({
                email: isEmailEmpty,
                password: isPasswordEmpty,
                displayName: isNameEmpty
            });
            setError('Пожалуйста, заполните обязательные поля.');
            return;
        }

        setSubmitting(true);
        try {
            await register(email, password, displayName.trim() || undefined);
            setDone(true);
        } catch (err: unknown) {
            setFieldErrors({ email: true, password: true, displayName: true });
            setError(extractError(err) ?? 'Не удалось зарегистрироваться.');
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="space-y-4 text-center mt-14">
                <h1 className="text-2xl font-semibold">Проверьте почту</h1>
                <p className="text-fg-muted">
                    Мы отправили ссылку на <span className="text-white font-medium">{email}</span>. Перейдите по ней, чтобы подтвердить email.
                </p>
                <div className="pt-6">
                    <Link to="/auth/login" className="text-accent hover:underline font-medium">
                        Вернуться ко входу
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold text-center">Начните слушать, создав аккаунт Copiuma</h1>

                {error && (
                    <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-md flex items-center gap-2">
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
                    label="Создайте пароль"
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
                        autoComplete="new-password"
                        required
                        minLength={8}
                        placeholder=" "
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={clearErrors}
                        className={`${fieldErrors.password ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <Field
                    label="Как нам Вас называть?"
                    htmlFor="name-input"
                    iconRight={
                        <svg className="w-5 h-5 text-fg-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    }
                >
                    <input
                        id="name-input"
                        type="text"
                        autoComplete="nickname"
                        required
                        maxLength={64}
                        placeholder=" "
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onFocus={clearErrors}
                        className={`${fieldErrors.displayName ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <div className="pt-6">
                    <button type="submit" disabled={submitting} className={`${btnPrimaryClass} !bg-accent text-fg`}>
                        {submitting ? 'Регистрируем…' : 'Продолжить'}
                    </button>
                </div>
            </form>

            <div className="flex flex-col items-center gap-6 text-sm pt-2">
                <Link to="/auth/login" className="group text-fg-muted">
                    Уже зарегистрированы в Copiuma?{' '}
                    <span className="underline font-medium tracking-tight group-hover:text-accent transition-colors">
                        ВОЙТИ
                    </span>
                </Link>
            </div>
        </div>
    );
}