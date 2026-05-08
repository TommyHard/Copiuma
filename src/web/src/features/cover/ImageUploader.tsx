import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Универсальный загрузчик картинки
 * Используется album cover и artist avatar
 */
export function ImageUploader({
    currentUrl,
    onUpload,
    onDelete,
    shape = 'square',
    label = 'Обложка',
}: {
    currentUrl?: string | null;
    onUpload: (file: File) => Promise<unknown>;
    onDelete?: () => Promise<unknown>;
    shape?: 'square' | 'circle' | 'banner';
    label?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const upload = useMutation({
        mutationFn: (f: File) => onUpload(f),
        onError: () => setError('Не удалось загрузить.'),
        onSuccess: () => setError(null),
    });

    const remove = useMutation({
        mutationFn: () => (onDelete ? onDelete() : Promise.resolve()),
    });

    function pick(f: File | null) {
        setError(null);
        if (!f) return;
        if (f.size > MAX_BYTES) {
            setError('Файл больше 10 МБ.');
            return;
        }
        if (!ALLOWED.includes(f.type)) {
            setError(`Тип "${f.type}" не разрешён (jpg/png/webp/gif).`);
            return;
        }
        upload.mutate(f);
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={upload.isPending}
                className={
                    'block cursor-pointer overflow-hidden border border-dashed border-border bg-bg-elevated bg-cover bg-center transition-opacity hover:opacity-90 disabled:opacity-50 ' +
                    (shape === 'circle'
                        ? 'size-32 rounded-full'
                        : shape === 'banner'
                            ? 'h-48 w-full rounded-b-lg md:h-64'
                            : 'size-32 rounded-md')
                }
                style={{ backgroundImage: currentUrl ? `url(${currentUrl})` : undefined }}
                title={`${label}: загрузить новый`}
                aria-label={`${label}: загрузить новый`}
            >
                {!currentUrl && (
                    <span className="grid h-full place-items-center text-xs text-fg-muted">
                        {upload.isPending ? '…' : '+ ' + label}
                    </span>
                )}
            </button>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />

            {currentUrl && onDelete && (
                <button
                    type="button"
                    onClick={() => {
                        if (confirm('Убрать изображение?')) remove.mutate();
                    }}
                    disabled={remove.isPending}
                    className="text-xs text-fg-muted hover:text-danger disabled:opacity-50"
                >
                    Убрать
                </button>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}
        </div>
    );
}