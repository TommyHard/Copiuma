import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '@/shared/api/auth';
import { extractError } from './LoginPage';

export function VerifyEmailPage() {
    const [params] = useSearchParams();
    const token = params.get('token');
    const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
    const [message, setMessage] = useState<string | null>(null);
    const requestedRef = useRef<string | null>(null);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Ссылка некорректна — отсутствует token.');
            return;
        }
        if (requestedRef.current === token) return;
        requestedRef.current = token;

        verifyEmail(token)
            .then((r) => {
                setStatus('success');
                setMessage(r.message);
            })
            .catch((err: unknown) => {
                setStatus('error');
                setMessage(extractError(err) ?? 'Не удалось подтвердить email.');
            });
    }, [token]);

    return (
        <div className="space-y-4 text-center mt-16">
            <h1 className="text-2xl font-semibold">Подтверждение email</h1>

            {status === 'pending' && <p className="text-fg-muted">Подтверждаем…</p>}

            {status === 'success' && (
                <>
                    <p className="text-success">{message}</p>
                    <Link to="/auth/login" className="inline-block text-accent hover:underline">
                        Войти
                    </Link>
                </>
            )}

            {status === 'error' && (
                <>
                    <p className="text-danger">{message}</p>
                    <Link to="/auth/resend-verification" className="inline-block text-accent hover:underline">
                        Запросить новую ссылку
                    </Link>
                </>
            )}
        </div>
    );
}