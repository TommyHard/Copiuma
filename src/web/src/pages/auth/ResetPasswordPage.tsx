import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

const baseInputClass =
    'peer w-full rounded-md border bg-bg-elevated px-3 py-2.5 text-fg outline-none transition-colors';
const errorInputClass = `${baseInputClass} border-danger focus:border-danger focus:ring-1 focus:ring-danger`;

export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const [fieldError, setFieldError] = useState(false);

    const clearErrors = () => {
        if (error || fieldError) {
            setError(null);
            setFieldError(false);
        }
    };

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setFieldError(false);

        if (!password) {
            setFieldError(true);
            setError('Пожалуйста, введите новый пароль.');
            return;
        }

        if (password.length < 8) {
            setFieldError(true);
            setError('Пароль должен содержать минимум 8 символов.');
            return;
        }

        setSubmitting(true);
        try {
            await resetPassword(token, password);
            setDone(true);
        } catch (err: unknown) {
            setFieldError(true);
            setError(extractError(err) ?? 'Не получилось сохранить пароль.');
        } finally {
            setSubmitting(false);
        }
    }

    if (!token) {
        return (
            <div className="space-y-4 text-center mt-8">
                <h1 className="text-2xl font-semibold">Ссылка некорректна</h1>
                <p className="text-fg-muted">Откройте email и перейдите по полной ссылке из письма.</p>
                <div className="pt-6">
                    <Link to="/auth/forgot-password" className="text-accent hover:underline font-medium">
                        Запросить заново
                    </Link>
                </div>
            </div>
        );
    }

    if (done) {
        return (
            <div className="space-y-4 text-center mt-16">
                <h1 className="text-2xl font-semibold">Пароль обновлён</h1>
                <p className="text-fg-muted">Все сессии завершены — войдите заново.</p>
                <div className="pt-6">
                    <Link to="/auth/login" className="text-accent hover:underline font-medium">
                        Войти
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 mt-8">
            <header>
                <h1 className="text-2xl font-semibold text-left">Новый пароль</h1>

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
                    label="Новый пароль"
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
                        className={`${fieldError ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <div className="pt-6">
                    <button type="submit" disabled={submitting} className={`${btnPrimaryClass} !bg-accent`}>
                        {submitting ? 'Сохраняем…' : 'Изменить пароль'}
                    </button>
                </div>
            </form>
        </div>
    );
}