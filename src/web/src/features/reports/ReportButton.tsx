import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createReport } from '@/shared/api/reports';
import type { ReportTargetType } from '@/shared/types';

const REASONS: { value: string; label: string }[] = [
    { value: 'copyright', label: 'Нарушение авторских прав' },
    { value: 'spam', label: 'Спам / рекламный контент' },
    { value: 'hate', label: 'Hate speech / экстремизм' },
    { value: 'sexual', label: '18+ контент без пометки' },
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
    const [reason, setReason] = useState(REASONS[0].value);
    const [details, setDetails] = useState('');
    const [done, setDone] = useState(false);

    const m = useMutation({
        mutationFn: () =>
            createReport({
                targetType,
                targetId,
                reason,
                details: details.trim() || undefined,
            }),
        onSuccess: () => {
            setDone(true);
            setDetails('');
        },
    });

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!reason) return;
        m.mutate();
    }

    return (
        <details className={className}>
            <summary className="cursor-pointer list-none rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-elevated">
                ⚠ Пожаловаться
            </summary>

            {done ? (
                <p className="mt-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success">
                    Жалоба отправлена. Модераторы посмотрят.
                </p>
            ) : (
                <form
                    onSubmit={onSubmit}
                    className="mt-3 space-y-3 rounded-md border border-border bg-bg-elevated p-3 text-sm"
                >
                    <label className="block">
                        <span className="mb-1 block text-fg-muted">Причина</span>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                        >
                            {REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-fg-muted">Дополнительно (опционально)</span>
                        <textarea
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
                        />
                    </label>

                    {m.isError && <p className="text-xs text-danger">Не удалось отправить.</p>}

                    <button
                        type="submit"
                        disabled={m.isPending}
                        className="rounded-md bg-danger px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {m.isPending ? '…' : 'Отправить'}
                    </button>
                </form>
            )}
        </details>
    );
}