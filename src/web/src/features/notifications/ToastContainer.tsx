import { useToasts } from './toastStore';

export function ToastContainer() {
    const items = useToasts((s) => s.items);
    const dismiss = useToasts((s) => s.dismiss);

    if (items.length === 0) return null;

    return (
        <div className="pointer-events-none fixed bottom-24 right-4 z-50 flex w-80 flex-col gap-2">
            {items.map((t) => (
                <div
                    key={t.id}
                    className="pointer-events-auto rounded-md border border-border bg-bg-elevated p-3 shadow-lg"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{t.notification.title}</div>
                            {t.notification.message && (
                                <div className="mt-1 text-xs text-fg-muted">{t.notification.message}</div>
                            )}
                        </div>
                        <button
                            onClick={() => dismiss(t.id)}
                            className="text-fg-muted hover:text-fg"
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}