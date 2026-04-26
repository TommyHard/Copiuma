import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '@/shared/api/auth';
import { btnPrimaryClass, extractError, Field, inputClass } from './LoginPage';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await forgotPassword(email);
            setDone(true);
        } catch (err: unknown) {
            setError(extractError(err) ?? 'Не получилось.');
        } finally {
            setSubmitting(false);
        }
    }

    if (done) {
        return (
            <div className="space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Письмо отправлено</h1>
                <p className="text-fg-muted">
                    Если такой email существует, мы отправили на него инструкцию по сбросу пароля. Ссылка
                    действительна 1 час.
                </p>
                <Link to="/auth/login" className="text-accent hover:underline">
                    Назад ко входу
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Сброс пароля</h1>
                <p className="mt-1 text-sm text-fg-muted">Введи email от аккаунта.</p>
            </header>
            <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Email">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                    />
                </Field>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button type="submit" disabled={submitting} className={btnPrimaryClass}>
                    {submitting ? 'Отправляем…' : 'Отправить ссылку'}
                </button>
            </form>
        </div>
    );
}