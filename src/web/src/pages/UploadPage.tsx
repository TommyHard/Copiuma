import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { uploadTrack, type UploadFields } from '@/shared/api/tracks';
import { getTrackStatus } from '@/shared/api/catalog';
import { getMyArtist, searchArtists } from '@/shared/api/artists';
import { listGenres } from '@/shared/api/genres';
import { searchUsers } from '@/shared/api/users';
import type { ArtistSummary, TrackProcessingStatus, UserSearchResult } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

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

    const myArtistQ = useQuery({
        queryKey: ['my-artist'],
        queryFn: getMyArtist,
        staleTime: 5 * 60 * 1000,
    });

    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
        staleTime: 10 * 60 * 1000,
    });

    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [artistName, setArtistName] = useState('');
    const [artistId, setArtistId] = useState<string | null>(null);
    const [artistQuery, setArtistQuery] = useState('');
    const [artistResults, setArtistResults] = useState<ArtistSummary[]>([]);
    const [artistSearching, setArtistSearching] = useState(false);
    const [genres, setGenres] = useState<string[]>([]);
    const [featuredArtists, setFeaturedArtists] = useState<{ id: string; name: string }[]>([]);
    const [featQuery, setFeatQuery] = useState('');
    const [featResults, setFeatResults] = useState<UserSearchResult[]>([]);
    const [featSearching, setFeatSearching] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [artistAutoFilled, setArtistAutoFilled] = useState(false);

    const [trackId, setTrackId] = useState<string | null>(null);
    const [status, setStatus] = useState<TrackProcessingStatus | null>(null);
    const pollingRef = useRef<number | null>(null);
    const artistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const featDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!artistAutoFilled && myArtistQ.data) {
            setArtistId(myArtistQ.data.id);
            setArtistName(myArtistQ.data.name);
            setArtistAutoFilled(true);
        }
    }, [myArtistQ.data, artistAutoFilled]);

    useEffect(() => {
        if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
        if (artistQuery.trim().length < 2) { setArtistResults([]); return; }
        artistDebounceRef.current = setTimeout(async () => {
            setArtistSearching(true);
            try { setArtistResults(await searchArtists(artistQuery)); }
            catch { setArtistResults([]); }
            finally { setArtistSearching(false); }
        }, 300);
    }, [artistQuery]);

    // Поиск доп. исполнителей среди пользователей
    useEffect(() => {
        if (featDebounceRef.current) clearTimeout(featDebounceRef.current);
        if (featQuery.trim().length < 2) { setFeatResults([]); return; }
        featDebounceRef.current = setTimeout(async () => {
            setFeatSearching(true);
            try { setFeatResults(await searchUsers(featQuery)); }
            catch { setFeatResults([]); }
            finally { setFeatSearching(false); }
        }, 300);
    }, [featQuery]);

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
        if (!f) { setFile(null); return; }
        if (f.size > MAX_BYTES) { setError('Файл больше 200 МБ.'); setFile(null); return; }
        if (f.type && !ALLOWED.includes(f.type)) { setError(`Тип "${f.type}" не разрешён.`); setFile(null); return; }
        setFile(f);
        if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    }

    function toggleGenre(g: string) {
        setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
    }

    function selectArtist(a: ArtistSummary) {
        setArtistId(a.id);
        setArtistName(a.name);
        setArtistQuery('');
        setArtistResults([]);
    }

    function clearArtist() {
        setArtistId(null);
        setArtistName('');
        setArtistQuery('');
        setArtistResults([]);
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
            artist: artistId ? undefined : (artistName.trim() || undefined),
            artistId: artistId ?? undefined,
            genres,
            featuredArtistIds: featuredArtists.length > 0 ? featuredArtists.map(a => a.id) : undefined,
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

    // After upload view
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

            <form onSubmit={onSubmit} className="space-y-5">
                <FilePicker file={file} onPick={onPickFile} disabled={submitting} />

                <Field label="Название *">
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

                {/* Artist search */}
                <div>
                    <span className="mb-1 block text-sm text-fg-muted">Исполнитель</span>

                    {artistId ? (
                        /* Selected artist */
                        <div className="flex items-center gap-2">
                            <Link
                                to={`/artists/${artistId}`}
                                className="rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent hover:underline"
                                target="_blank"
                            >
                                {artistName}
                            </Link>
                            <button
                                type="button"
                                onClick={clearArtist}
                                disabled={submitting}
                                className="text-xs text-fg-muted hover:text-danger"
                            >
                                × Сменить
                            </button>
                        </div>
                    ) : (
                        /* Artist search input */
                        <div className="relative">
                            <input
                                type="text"
                                value={artistQuery || artistName}
                                onChange={(e) => {
                                    setArtistName(e.target.value);
                                    setArtistQuery(e.target.value);
                                }}
                                placeholder="Найди исполнителя из каталога или введи имя вручную…"
                                disabled={submitting}
                                className={inputClass}
                            />
                            {artistSearching && (
                                <p className="mt-1 text-xs text-fg-muted">Поиск…</p>
                            )}
                            {artistResults.length > 0 && (
                                <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-elevated shadow-lg">
                                    {artistResults.map((a) => (
                                        <li key={a.id}>
                                            <button
                                                type="button"
                                                onClick={() => selectArtist(a)}
                                                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg"
                                            >
                                                {a.avatarUrl && (
                                                    <img
                                                        src={a.avatarUrl}
                                                        alt=""
                                                        className="size-6 rounded-full object-cover"
                                                    />
                                                )}
                                                <span>{a.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <p className="mt-1 text-xs text-fg-muted">
                        Выбери артиста из каталога, чтобы трек привязался к странице артиста, или оставь как текст.
                    </p>
                </div>

                {/* Featured artists (доп. исполнители) */}
                <div>
                    <span className="mb-1 block text-sm text-fg-muted">Доп. исполнители (feat.)</span>

                    {featuredArtists.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2">
                            {featuredArtists.map((a) => (
                                <span
                                    key={a.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent"
                                >
                                    {a.name}
                                    <button
                                        type="button"
                                        onClick={() => setFeaturedArtists((prev) => prev.filter((x) => x.id !== a.id))}
                                        disabled={submitting}
                                        className="ml-0.5 text-fg-muted hover:text-danger"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="relative max-w-md">
                        <input
                            type="text"
                            value={featQuery}
                            onChange={(e) => setFeatQuery(e.target.value)}
                            placeholder="Поиск пользователя для добавления…"
                            disabled={submitting}
                            className={inputClass}
                        />
                        {featSearching && <p className="mt-1 text-xs text-fg-muted">Поиск…</p>}
                        {featResults.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-elevated shadow-lg">
                                {featResults
                                    .filter((u) => !featuredArtists.some((a) => a.id === u.id))
                                    .map((u) => (
                                        <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-bg">
                                            <span className="text-sm">{u.displayName}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFeaturedArtists((prev) => [...prev, { id: u.id, name: u.displayName }]);
                                                    setFeatQuery('');
                                                    setFeatResults([]);
                                                }}
                                                className="rounded-md bg-accent px-2 py-1 text-xs text-accent-fg hover:opacity-90"
                                            >
                                                Добавить
                                            </button>
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Genre checkboxes */}
                <div>
                    <span className="mb-2 block text-sm text-fg-muted">Жанры</span>
                    <div className="flex flex-wrap gap-2">
                        {(genresQ.data ?? []).map((g) => {
                            const selected = genres.includes(g.slug);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleGenre(g.slug)}
                                    disabled={submitting}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
                                        selected
                                            ? 'border-accent bg-accent/15 text-accent'
                                            : 'border-border text-fg-muted hover:border-accent/50 hover:text-fg',
                                    )}
                                >
                                    {g.displayName}
                                </button>
                            );
                        })}
                    </div>
                    {genres.length > 0 && (
                        <p className="mt-2 text-xs text-fg-muted">
                            Выбрано: {genres.join(', ')}
                        </p>
                    )}
                </div>

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
                    className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
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