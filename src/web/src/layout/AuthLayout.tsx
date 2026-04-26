import { Outlet } from 'react-router-dom';
import logoUrl from '/assets/icons/Copiuma_Logo.svg';

export function AuthLayout() {
    return (
        <div className="grid min-h-screen place-items-center bg-bg p-6">
            <main className="w-full max-w-sm rounded-lg border border-border bg-bg-elevated p-6 shadow-lg">
                <div className="mb-6 flex items-center gap-2">
                    <img
                        src={logoUrl}
                        alt=""
                        className="w-10 h-auto rounded-md"
                        aria-hidden
                    />
                    <span className="text-lg font-semibold tracking-tight">Copiuma</span>
                </div>
                <Outlet />
            </main>
        </div>
    );
}