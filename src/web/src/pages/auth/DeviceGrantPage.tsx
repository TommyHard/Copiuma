import { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { deviceAuthorize } from '@/shared/api/auth';
import { extractError, btnPrimaryClass } from './LoginPage';

/**
 * PKCE: web-страница, на которую desktop-app открывает браузер
 *
 * Query (всё, что прислал desktop):
 *   client_id, redirect_uri, code_challenge, code_challenge_method, state
 *
 * Если юзер не залогинен — редирект на /auth/login с возвратом сюда после успеха
 * Если залогинен и подтверждён — кнопка «Разрешить»; на клик POST
 */
export function DeviceGrantPage() {
    const { status, user } = useAuth();
    const loc = useLocation();
    const [params] = useSearchParams();

    const clientId = params.get('client_id') ?? '';
    const redirectUri = params.get('redirect_uri') ?? '';
    const codeChallenge = params.get('code_challenge') ?? '';
    const codeChallengeMethod = (params.get('code_challenge_method') ?? 'S256') as 'S256';
    const state = params.get('state') ?? undefined;

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (status === 'unauthenticated') {
        return <Navigate to="/auth/login" state={{ from: loc }} replace />;
    }

    if (status === 'loading' || !user) {
        return <p className="text-center text-fg-muted">Загрузка…</p>;
    }

    if (!user.emailVerified) {
        return (
            <div className="space-y-3 text-center">
                <h1 className="text-2xl font-semibold">Подтверди email</h1>
                <p className="text-fg-muted">Авторизация десктопа требует подтверждённого email.</p>
            </div>
        );
    }

    if (!clientId || !redirectUri || !codeChallenge) {
        return (
            <div className="space-y-3 text-center">
                <h1 className="text-2xl font-semibold">Некорректный запрос</h1>
                <p className="text-fg-muted">
                    Отсутствуют обязательные параметры (client_id / redirect_uri / code_challenge).
                </p>
            </div>
        );
    }

    async function approve() {
        setError(null);
        setBusy(true);
        try {
            const r = await deviceAuthorize({
                clientId,
                redirectUri,
                codeChallenge,
                codeChallengeMethod,
                state,
                deviceLabel: 'Copiuma Desktop',
            });
            window.location.replace(r.redirectTo);
        } catch (err: unknown) {
            setError(extractError(err) ?? 'Не удалось авторизовать.');
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <header className="text-center">
                <h1 className="text-2xl font-semibold">Авторизовать приложение</h1>
                <p className="mt-2 text-sm text-fg-muted">
                    <span className="text-fg">{clientId}</span> запрашивает доступ к аккаунту{' '}
                    <span className="text-fg">{user.email}</span>.
                </p>
            </header>

            <UseEffectLogger redirectUri={redirectUri} />

            {error && <p className="text-center text-sm text-danger">{error}</p>}

            <button onClick={approve} disabled={busy} className={btnPrimaryClass}>
                {busy ? 'Авторизуем…' : 'Разрешить и продолжить'}
            </button>

            <p className="text-center text-xs text-fg-muted">
                После клика браузер вернётся в приложение по адресу{' '}
                <span className="break-all text-fg">{redirectUri}</span>.
            </p>
        </div>
    );
}

function UseEffectLogger({ redirectUri }: { redirectUri: string }) {
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.debug('[device-grant] redirectUri =', redirectUri);
        }
    }, [redirectUri]);
    return null;
}