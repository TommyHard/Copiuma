import { cn } from '@/shared/lib/cn';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = 'ОК', cancelText = 'Отмена', danger }: ConfirmDialogProps) {
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
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-fg/10 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={cn(
                            "rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity shadow-sm",
                            danger ? "bg-danger text-white hover:opacity-90" : "bg-accent text-accent-fg hover:opacity-90"
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}