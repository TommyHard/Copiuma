import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadTrack, type UploadFields } from '@/shared/api/tracks';
import { getTrackStatus } from '@/shared/api/catalog';
import type { TrackProcessingStatus } from '@/shared/types';

const ALLOWED = [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/flac',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/mp4',
];
const MAX_BYTES = 200 * 1024 * 1024;

export function UploadPage() {
    const navigate = useNavigate();

    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [artistName, setArtistName] = useState('');
    const [genres, setGenres] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const [trackId, setTrackId] = useState<string | null>(null);
    const [status, setStatus] = useState<TrackProcessingStatus | null>(null);
    const pollingRef = useRef<number | null>(null);

    // polling после загрузки
    useEffect(() => {
        if (!trackId) return;
        let cancelled = false;

        async function tick() {
            if (cancelled || !trackId) return;
            try {
                const r = await getTrackStatus(trackId);
                setStatus(r.status);
                if (r.status === 'Ready' || r.status === 'Failed') return;
            } catch {
            }
            pollingRef.current = window.setTimeout(tick, 3000);
        }

        void tick();

        return () => {
            cancelled = true;
            if (pollingRef.current) window.clearTimeout(pollingRef.current);
        };
    }, [trackId]);

    function onPickFile(f: File | null) {
        setError(null);
        if (!f) {
            setFile(null);
            return;
        }
        if (f.size > MAX_BYTES) {
            setError('Файл больше 200 МБ.');
            setFile(null);
            return;
        }
        if (f.type && !ALLOWED.includes(f.type)) {
            setError(`Тип "${f.type}" не разрешён.`);
            setFile(null);
            return;
        }
        setFile(f);
        if (!title) {
            setTitle(f.name.replace(/\.[^.]+$/, ''));
        }
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!file || !title.trim()) return;

        setError(null);
        setSubmitting(true);
        setProgress(0);
        setTrackId(null);
        setStatus(null);

        const fields: UploadFields = {
            title: title.trim(),
            artist: artistName.trim() || undefined,
            genres: genres
                .split(',')
                .map((g) => g.trim().toLowerCase())
                .filter(Boolean),
        };

        try {
            const r = await uploadTrack(file, fields, setProgress);
            setTrackId(r.trackId);
        } catch (err: unknown) {
            const data = (err as any)?.response?.data;
            setError(typeof data === 'string' ? data : data?.message ?? 'Не удалось загрузить.');
        } finally {
            setSubmitting(false);
        }
    }

    // Render

    if (trackId) {
        return (
            <section className="mx-auto max-w-md space-y-4 text-center">
                <h1 className="text-2xl font-semibold">Загружено</h1>
                <p className="text-fg-muted">
                    Трек ушёл в обработку. Текущий статус: <span className="text-fg">{status ?? '...'}</span>.
                </p>
                {status === 'Ready' && (
                    <button
                        onClick={() => navigate(`/tracks/${trackId}`)}
                        className="rounded-md bg-accent px-4 py-2 text-accent-fg hover:opacity-90"
                    >
                        Открыть страницу трека
                    </button>
                )}
                {status === 'Failed' && (
                    <p className="text-danger">
                        Обработка упала. Посмотри логи воркера или попробуй залить заново.
                    </p>
                )}
                {(status === null || status === 'Pending' || status === 'Processing') && (
                    <p className="text-sm text-fg-muted">
                        Опрашиваем статус каждые 3 секунды; обычно ≤1× длительности трека на slow CPU.
                    </p>
                )}
            </section>
        );
    }

    return (
        <section className="mx-auto max-w-2xl space-y-6">
            <header>
                <h1 className="text-2xl font-semibold">Загрузка трека</h1>
                <p className="mt-1 text-sm text-fg-muted">
                    MP3 / WAV / FLAC / OGG / AAC / M4A. До 200 МБ. После загрузки трек уйдёт в pipeline
                    (анализ + HLS-транскод).
                </p>
            </header>

            <form onSubmit={onSubmit} className="space-y-4">
                <FilePicker file={file} onPick={onPickFile} disabled={submitting} />

                <Field label="Название">
                    <input
                        type="text"
                        required
                        maxLength={200}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                    />
                </Field>

                <Field label="Исполнитель (если без привязки к каталогу)">
                    <input
                        type="text"
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                    />
                </Field>

                <Field label="Жанры (через запятую: rock, post-punk)">
                    <input
                        type="text"
                        value={genres}
                        onChange={(e) => setGenres(e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                    />
                </Field>

                {submitting && (
                    <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded bg-bg-elevated">
                            <div
                                className="h-full bg-accent transition-[width]"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-fg-muted">Загружаем — {progress}%</p>
                    </div>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <button
                    type="submit"
                    disabled={submitting || !file || !title.trim()}
                    className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                    {submitting ? 'Загружаем…' : 'Загрузить'}
                </button>
            </form>
        </section>
    );
}

function FilePicker({
    file,
    onPick,
    disabled,
}: {
    file: File | null;
    onPick: (f: File | null) => void;
    disabled?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="rounded-md border border-dashed border-border bg-bg-elevated p-6 text-center">
            {file ? (
                <div className="space-y-2 text-sm">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-fg-muted">
                        {file.type || 'unknown'} · {(file.size / 1024 / 1024).toFixed(1)} МБ
                    </p>
                    <button
                        type="button"
                        onClick={() => onPick(null)}
                        disabled={disabled}
                        className="text-xs text-fg-muted underline hover:text-fg disabled:opacity-50"
                    >
                        Заменить файл
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-sm text-fg-muted">Перетащи файл сюда или</p>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                        className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg disabled:opacity-50"
                    >
                        Выбрать
                    </button>
                </>
            )}
            <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm text-fg-muted">{label}</span>
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-fg outline-none ' +
    'focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50';