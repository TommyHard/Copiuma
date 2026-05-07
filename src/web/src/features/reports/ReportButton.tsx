import { useState, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createReport } from '@/shared/api/reports';
import type { ReportTargetType } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

const REASONS: { value: string; label: string }[] = [
    { value: 'copyright', label: 'Нарушение авторских прав' },
    { value: 'spam', label: 'Спам / рекламный контент' },
    { value: 'offensive', label: 'Hate speech / экстремизм' },
    { value: 'harassment', label: 'Оскорбление / Травля' },
    { value: 'illegal', label: 'Запрещенный 18+ контент' },
    { value: 'other', label: 'Другое (опиши ниже)' },
];

export function ReportButton({
    targetType,
    targetId,
    className,
}: {
    targetType: ReportTargetType;
    targetId: string;
    className?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [reason, setReason] = useState(REASONS[0].value);
    const [details, setDetails] = useState('');
    const [done, setDone] = useState(false);

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
            <button
                onClick={() => setIsOpen(true)}
                className={cn(
                    "rounded-md px-4 py-2 text-[1rem] font-medium text-white hover:bg-black/40 transition-colors outline-none",
                    className
                )}
            >
                Пожаловаться
            </button>

            {isOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={handleClose}
                >
                    <div
                        className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-fg">Отправить жалобу</h3>
                                <p className="text-sm text-fg-muted mt-1">
                                    Пожалуйста, подробно опишите причину. Мы проверяем каждое обращение.
                                </p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="rounded-md p-1.5 text-fg-muted hover:bg-bg hover:text-fg transition-colors"
                            >
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {done ? (
                            <div className="rounded-lg bg-accent/10 border border-accent/20 p-6 text-center">
                                <p className="text-base font-semibold text-accent mb-2">Жалоба успешно отправлена</p>
                                <p className="text-sm text-fg-muted mb-6">Спасибо за помощь в поддержании порядка на платформе.</p>
                                <button
                                    onClick={handleClose}
                                    className="rounded-md bg-bg px-6 py-2 text-sm font-medium text-fg hover:bg-bg-elevated transition-colors border border-border"
                                >
                                    Закрыть
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <label className="block space-y-2">
                                    <span className="block text-sm font-medium text-fg">Причина жалобы</span>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        className="w-full rounded-md border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors hover:border-border/80 focus:border-accent focus:ring-1 focus:ring-accent"
                                    >
                                        {REASONS.map((r) => (
                                            <option key={r.value} value={r.value} className="bg-bg-elevated">
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-2">
                                    <span className="block text-sm font-medium text-fg">
                                        Дополнительные детали <span className="text-fg-muted font-normal">(необязательно)</span>
                                    </span>
                                    <textarea
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                        maxLength={1000}
                                        rows={4}
                                        placeholder="Укажите таймкоды, ссылки или другие подробности..."
                                        className="w-full resize-none rounded-md border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors hover:border-border/80 focus:border-accent focus:ring-1 focus:ring-accent placeholder:text-fg-muted/50"
                                    />
                                </label>

                                {m.isError && (
                                    <div className="rounded-md bg-danger/10 p-3 text-sm text-danger border border-danger/20">
                                        Произошла ошибка при отправке. Попробуйте еще раз.
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-border/50">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="rounded-md px-4 py-2 text-sm font-medium text-fg hover:bg-bg-elevated transition-colors"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={m.isPending}
                                        className="rounded-md bg-danger px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-danger/90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
                                    >
                                        {m.isPending ? 'Отправка...' : 'Отправить жалобу'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}