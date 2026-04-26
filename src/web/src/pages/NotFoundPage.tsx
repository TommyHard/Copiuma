import { Link } from 'react-router-dom';

export function NotFoundPage() {
    return (
        <div className="grid min-h-screen place-items-center bg-bg p-6 text-center">
            <div>
                <h1 className="text-4xl font-semibold">404</h1>
                <p className="mt-3 text-fg-muted">Страницы нет.</p>
                <Link to="/" className="mt-6 inline-block text-accent hover:underline">
                    На главную
                </Link>
            </div>
        </div>
    );
}