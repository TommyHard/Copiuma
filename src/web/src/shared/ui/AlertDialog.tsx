import { useAlertStore } from '@/shared/store/alertStore';

export function AlertDialog() {
    const { isOpen, message, title, closeAlert } = useAlertStore();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-xl animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
            >
                <h2 className="text-xl font-bold tracking-tight text-fg mb-3">{title}</h2>
                <p className="text-sm text-fg-muted mb-8 whitespace-pre-wrap leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end">
                    <button
                        onClick={closeAlert}
                        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
                    >
                        Понятно
                    </button>
                </div>
            </div>
        </div>
    );
}