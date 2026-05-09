import { useState, useEffect, type FormEvent, type ReactNode, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { createReport } from '@/shared/api/reports';
import type { ReportTargetType } from '@/shared/types';

const REASONS: { value: string; label: string }[] = [
    { value: 'copyright', label: 'Нарушение авторских прав' },
    { value: 'spam', label: 'Спам / рекламный контент' },
    { value: 'offensive', label: 'Hate speech / экстремизм' },
    { value: 'harassment', label: 'Оскорбление / Травля' },
    { value: 'illegal', label: 'Запрещенный 18+ контент' },
    { value: 'other', label: 'Другое (опиши ниже)' },
];

export interface ReportButtonRef {
    open: () => void;
}

export const ReportButton = forwardRef<
    ReportButtonRef,
    { targetType: ReportTargetType; targetId: string; className?: string; children?: ReactNode; onClickExtra?: () => void }
>(({ targetType, targetId, className, children, onClickExtra }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [reason, setReason] = useState(REASONS[0].value);
    const [details, setDetails] = useState('');
    const [done, setDone] = useState(false);

    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true)
    }));

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const m = useMutation({
        mutationFn: () =>
            createReport({
                targetType,
                targetId,
                reason,
                details: details.trim() || undefined,
            }),
        onSuccess: () => setDone(true),
    });

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        m.mutate();
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => {
            setDone(false);
            setDetails('');
            setReason(REASONS[0].value);
        }, 300);
    };

    return (
        <>
            {children && (
                <button
                    onClick={() => {
                        setIsOpen(true);
                        onClickExtra?.();
                    }}
                    className={className}
                >
                    {children}
                </button>
            )}

            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={handleClose}
                >
                    <div
                        className="w-full max-w-lg rounded-2xl border border-border bg-bg-elevated p-8 shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-fg tracking-tight">Отправить жалобу</h3>
                                <p className="text-sm text-fg-muted mt-1 font-medium">
                                    Пожалуйста, подробно опишите причину. Мы проверяем каждое обращение.
                                </p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="rounded-full p-2 text-fg-muted hover:bg-bg hover:text-fg transition-colors"
                            >
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {done ? (
                            <div className="rounded-xl bg-accent/10 border border-accent/20 p-8 text-center">
                                <p className="text-lg font-bold text-accent mb-2">Жалоба успешно отправлена</p>
                                <p className="text-sm text-fg-muted mb-8">Спасибо за помощь.</p>
                                <button
                                    onClick={handleClose}
                                    className="px-6 py-2.5 rounded bg-bg hover:bg-fg/10 text-fg font-bold tracking-wide transition-colors"
                                >
                                    Закрыть
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <label className="block space-y-2">
                                    <span className="block text-sm font-bold text-fg">Причина жалобы</span>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-all hover:border-border/80 focus:border-accent"
                                    >
                                        {REASONS.map((r) => (
                                            <option key={r.value} value={r.value} className="bg-bg-elevated">
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-2">
                                    <span className="block text-sm font-bold text-fg">Дополнительные детали</span>
                                    <textarea
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                        maxLength={1000}
                                        rows={4}
                                        placeholder="Укажите подробности..."
                                        className="w-full resize-none rounded-lg border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-all hover:border-border/80 focus:border-accent"
                                    />
                                </label>

                                <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-border/50">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="px-5 py-2.5 rounded bg-bg hover:bg-fg/10 text-fg font-bold transition-all"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={m.isPending}
                                        className="px-5 py-2.5 rounded bg-danger hover:bg-danger/90 text-white font-bold transition-all"
                                    >
                                        Отправить
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
});