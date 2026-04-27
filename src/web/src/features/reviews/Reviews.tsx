import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createReview,
    deleteReview,
    likeReview,
    listReviews,
    unlikeReview,
    updateReview,
} from '@/shared/api/reviews';
import type { ReviewItem } from '@/shared/types';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';

/**
 * Reviews-секция: форма "написать", список, лайки, редактирование/удаление своего
 */
export function Reviews({ trackId }: { trackId: string }) {
    const qc = useQueryClient();
    const { user } = useAuth();

    const list = useQuery({ queryKey: ['reviews', trackId], queryFn: () => listReviews(trackId) });

    const myReview = list.data?.find((r) => r.authorId === user?.id) ?? null;

    return (
        <section className="space-y-4">
            <h2 className="text-xl font-semibold">Отзывы</h2>
            {!myReview && <ReviewForm trackId={trackId} onDone={() => qc.invalidateQueries({ queryKey: ['reviews', trackId] })} />}
            {list.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {list.data && list.data.length === 0 && (
                <p className="text-fg-muted">Никто ещё не оставил отзыв. Будь первым.</p>
            )}
            {list.data && list.data.length > 0 && (
                <ul className="space-y-3">
                    {list.data.map((rev) => (
                        <ReviewRow key={rev.id} review={rev} canEdit={rev.authorId === user?.id} trackId={trackId} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function ReviewForm({
    trackId,
    initial,
    reviewId,
    onDone,
    onCancel,
}: {
    trackId: string;
    initial?: string;
    reviewId?: string;
    onDone: () => void;
    onCancel?: () => void;
}) {
    const [text, setText] = useState(initial ?? '');

    const m = useMutation({
        mutationFn: () =>
            reviewId
                ? updateReview(reviewId, text.trim())
                : createReview(trackId, text.trim()),
        onSuccess: () => {
            setText('');
            onDone();
        },
    });

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!text.trim()) return;
        m.mutate();
    }

    return (
        <form onSubmit={onSubmit} className="space-y-2 rounded-md border border-border bg-bg-elevated p-3">
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Что думаешь о треке?"
                maxLength={2000}
                rows={3}
                className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg"
                    >
                        Отмена
                    </button>
                )}
                <button
                    type="submit"
                    disabled={m.isPending || !text.trim()}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {m.isPending ? '…' : reviewId ? 'Сохранить' : 'Оставить отзыв'}
                </button>
            </div>
            {m.isError && <p className="text-xs text-danger">Не удалось сохранить.</p>}
        </form>
    );
}

function ReviewRow({
    review,
    canEdit,
    trackId,
}: {
    review: ReviewItem;
    canEdit: boolean;
    trackId: string;
}) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState(false);

    const like = useMutation({
        mutationFn: () => (review.likedByMe ? unlikeReview(review.id) : likeReview(review.id)),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', trackId] }),
    });
    const remove = useMutation({
        mutationFn: () => deleteReview(review.id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', trackId] }),
    });

    if (editing) {
        return (
            <li>
                <ReviewForm
                    trackId={trackId}
                    initial={review.text}
                    reviewId={review.id}
                    onDone={() => {
                        setEditing(false);
                        qc.invalidateQueries({ queryKey: ['reviews', trackId] });
                    }}
                    onCancel={() => setEditing(false)}
                />
            </li>
        );
    }

    return (
        <li className="rounded-md border border-border bg-bg-elevated p-3">
            <header className="mb-1 flex items-baseline justify-between gap-2 text-xs text-fg-muted">
                <span className="truncate font-medium text-fg">
                    {review.authorName ?? review.authorId.slice(0, 8)}
                </span>
                <span>{new Date(review.createdAt).toLocaleString('ru')}</span>
            </header>
            <p className="whitespace-pre-line text-sm">{review.text}</p>
            <footer className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
                <button
                    onClick={() => like.mutate()}
                    disabled={like.isPending}
                    className={cn(
                        'rounded-full border border-border px-2 py-0.5 hover:bg-bg disabled:opacity-50',
                        review.likedByMe && 'border-accent/60 text-accent',
                    )}
                >
                    ♥ {review.likeCount}
                </button>
                {canEdit && (
                    <>
                        <button onClick={() => setEditing(true)} className="hover:text-fg">
                            Изменить
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Удалить отзыв?')) remove.mutate();
                            }}
                            disabled={remove.isPending}
                            className="hover:text-danger disabled:opacity-50"
                        >
                            Удалить
                        </button>
                    </>
                )}
            </footer>
        </li>
    );
}