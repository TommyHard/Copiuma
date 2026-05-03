import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { resendVerification } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

const baseInputClass =
    'peer w-full rounded-md border bg-bg-elevated px-3 py-2.5 text-fg outline-none transition-colors';
const errorInputClass = `${baseInputClass} border-danger focus:border-danger focus:ring-1 focus:ring-danger`;

export function ResendVerificationPage() {
    const [email, setEmail] = useState('');
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

        if (!email.trim()) {
            setFieldError(true);
            setError('Пожалуйста, введите ваш email.');
            return;
        }

        setSubmitting(true);
        try {
            await resendVerification(email);
            setDone(true);
        } catch (err: unknown) {
            setFieldError(true);
            setError(extractError(err) ?? 'Не получилось отправить.');
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="space-y-4 text-center mt-14">
                <h1 className="text-2xl font-semibold">Письмо отправлено</h1>
                <p className="text-fg-muted">
                    Если такой email существует и ещё не подтверждён, на него отправлено письмо.
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
                <h1 className="text-2xl font-semibold text-center">Отправить ссылку снова</h1>
                <p className="mt-2 text-sm text-fg-muted text-center">
                    Введите email для повторной отправки письма с подтверждением.
                </p>

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
                        required
                        placeholder=" "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={clearErrors}
                        className={`${fieldError ? errorInputClass : inputClass} pr-10`}
                    />
                </Field>

                <div className="pt-6">
                    <button type="submit" disabled={submitting} className={`${btnPrimaryClass} !bg-accent`}>
                        {submitting ? 'Отправляем…' : 'Отправить'}
                    </button>
                </div>
            </form>

            <div className="flex flex-col items-center gap-6 text-sm pt-2">
                <Link to="/auth/login" className="group text-fg-muted">
                    Уже подтвердили?{' '}
                    <span className="underline font-medium text-white group-hover:text-accent transition-colors">
                        ВОЙТИ
                    </span>
                </Link>
            </div>
        </div>
    );
}