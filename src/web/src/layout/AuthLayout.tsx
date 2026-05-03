import { Outlet } from 'react-router-dom';
import { memo } from 'react';
import LogoComponent from '/assets/icons/Copiuma_Logo.svg?react';

const Logo = memo(() => (
    <LogoComponent
        className="w-16 h-auto rounded-md"
        aria-hidden="true" />
));

export function AuthLayout() {
    return (
        <div className="grid min-h-screen place-items-center bg-bg p-6">
            <main className="w-full max-w-md min-h-[600px] flex flex-col rounded-lg border border-border bg-bg-elevated px-10 py-12 shadow-lg">
                <div className="mb-8 flex items-center justify-center gap-3">
                    <Logo />
                    <span className="text-2xl font-normal tracking-tight">Copiuma</span>
                </div>
                <div className="flex-1 flex flex-col">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}