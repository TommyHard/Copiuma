import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { register } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

export function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await register(email, password, displayName.trim() || undefined);
            setDone(true);
        } catch (err: unknown) {
            setError(extractError(err) ?? 'Не удалось зарегистрироваться.');
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Проверь почту</h1>
                <p className="text-fg-muted">
                    Мы отправили ссылку на <span className="text-fg">{email}</span>. Перейди по ней, чтобы подтвердить email.
                </p>
                <Link to="/auth/login" className="text-accent hover:underline">
                    Вернуться ко входу
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Регистрация</h1>
                <p className="mt-1 text-sm text-fg-muted">
                    После регистрации мы пришлём письмо со ссылкой подтверждения.
                </p>
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

                <Field label="Имя (видно другим, можно поменять позже)">
                    <input
                        type="text"
                        autoComplete="nickname"
                        maxLength={64}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className={inputClass}
                    />
                </Field>

                <Field label="Пароль (минимум 8 символов)">
                    <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                    />
                </Field>

                {error && <p className="text-sm text-danger">{error}</p>}

                <button type="submit" disabled={submitting} className={btnPrimaryClass}>
                    {submitting ? 'Регистрируем…' : 'Создать аккаунт'}
                </button>
            </form>

            <div className="text-center text-sm text-fg-muted">
                Уже есть аккаунт?{' '}
                <Link to="/auth/login" className="text-accent hover:underline">
                    Войти
                </Link>
            </div>
        </div>
    );
}