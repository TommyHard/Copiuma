import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await resetPassword(token, password);
            setDone(true);
        } catch (err: unknown) {
            setError(extractError(err) ?? 'Не получилось.');
        } finally {
            setSubmitting(false);
        }
    }

    if (!token) {
        return (
            <div className="space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Ссылка некорректна</h1>
                <p className="text-fg-muted">Открой email и перейди по полной ссылке из письма.</p>
                <Link to="/auth/forgot-password" className="text-accent hover:underline">
                    Запросить заново
                </Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Пароль обновлён</h1>
                <p className="text-fg-muted">Все сессии завершены — войди заново.</p>
                <Link to="/auth/login" className="text-accent hover:underline">
                    Войти
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Новый пароль</h1>
            </header>
            <form onSubmit={onSubmit} className="space-y-4">
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
                    {submitting ? 'Сохраняем…' : 'Сохранить'}
                </button>
            </form>
        </div>
    );
}