import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { uploadTrack, type UploadFields } from '@/shared/api/tracks';
import { getTrackStatus } from '@/shared/api/catalog';
import { getMyArtist, searchArtists } from '@/shared/api/artists';
import { listGenres } from '@/shared/api/genres';
import { createAlbum, uploadAlbumCover } from '@/shared/api/albums';
import type { ArtistSummary, TrackProcessingStatus } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

const ALLOWED_AUDIO = [
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
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Mode = 'track' | 'album';

interface AlbumTrackEntry {
    id: string;
    file: File | null;
    title: string;
    cover: File | null;
    featuredArtists: { id: string; name: string }[];
    fileError?: string;
    coverError?: string;
}

function newTrackEntry(): AlbumTrackEntry {
    return { id: crypto.randomUUID(), file: null, title: '', cover: null, featuredArtists: [] };
}

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

    const [mode, setMode] = useState<Mode>('track');

    if (myArtistQ.isLoading) {
        return <p className="text-fg-muted">Загружаем профиль артиста…</p>;
    }

    const me = myArtistQ.data ?? null;

    if (!me) {
        return (
            <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-bg-elevated p-8 shadow-sm mt-8">
                <h1 className="text-2xl font-semibold">Нужен профиль артиста</h1>
                <p className="text-sm text-fg-muted">
                    Загружать музыку можно только под своим артист-профилем. Создайте профиль, чтобы продолжить.
                </p>
                <Link
                    to="/artist/settings"
                    className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
                >
                    Создать профиль артиста
                </Link>
            </section>
        );
    }

    const genresList = (genresQ.data ?? []).map((g) => ({ slug: g.slug, displayName: g.displayName, id: g.id }));

    return (
        <section className="mx-auto max-w-3xl space-y-6 pt-8 pb-12">
            <header className="space-y-2">
                <h1 className="text-2xl font-semibold tracking-tight">Загрузка музыки</h1>
                <p className="text-sm text-fg-muted">
                    Один трек или целый альбом. Аудио - MP3/WAV/FLAC/OGG/AAC до 200&nbsp;МБ.
                    Обложки — JPEG/PNG/WEBP до 10&nbsp;МБ.
                </p>
            </header>

            <div className="inline-flex rounded-lg border border-border bg-bg-elevated p-1 shadow-sm">
                <button
                    type="button"
                    onClick={() => setMode('track')}
                    className={cn(
                        'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                        mode === 'track'
                            ? 'bg-accent text-accent-fg shadow-sm'
                            : 'text-fg-muted hover:text-fg hover:bg-bg/50',
                    )}
                >
                    Один трек
                </button>
                <button
                    type="button"
                    onClick={() => setMode('album')}
                    className={cn(
                        'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                        mode === 'album'
                            ? 'bg-accent text-accent-fg shadow-sm'
                            : 'text-fg-muted hover:text-fg hover:bg-bg/50',
                    )}
                >
                    Альбом
                </button>
            </div>

            <LockedArtistCard me={me} />

            <div className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
                {mode === 'track' ? (
                    <SingleTrackForm
                        artistId={me.id}
                        genresList={genresList}
                        navigate={navigate}
                    />
                ) : (
                    <AlbumForm
                        artistId={me.id}
                        genresList={genresList}
                        navigate={navigate}
                    />
                )}
            </div>
        </section>
    );
}

function LockedArtistCard({ me }: { me: ArtistSummary }) {
    return (
        <div className="rounded-xl border border-border bg-bg p-4 shadow-sm">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-fg-muted">
                Исполнитель
            </span>
            <div className="flex items-center gap-4">
                <div
                    className="size-12 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center ring-2 ring-border"
                    style={{ backgroundImage: me.avatarUrl ? `url(${me.avatarUrl})` : undefined }}
                    aria-hidden
                />
                <div className="min-w-0 flex-1">
                    <Link
                        to={`/artists/${me.id}`}
                        target="_blank"
                        className="block truncate text-lg font-medium hover:underline"
                    >
                        {me.name}
                    </Link>
                    <p className="text-sm text-fg-muted mt-0.5">
                        Загрузка идёт под вашим профилем артиста.{' '}
                        <Link to="/artist/settings" className="text-accent hover:underline transition-colors">
                            Настроить профиль
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Single track form

function SingleTrackForm({
    artistId,
    genresList,
    navigate,
}: {
    artistId: string;
    genresList: { slug: string; displayName: string; id: string }[];
    navigate: (to: string) => void;
}) {
    const [file, setFile] = useState<File | null>(null);
    const [cover, setCover] = useState<File | null>(null);
    const [title, setTitle] = useState('');
    const [genres, setGenres] = useState<string[]>([]);
    const [featuredArtists, setFeaturedArtists] = useState<{ id: string; name: string }[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [trackId, setTrackId] = useState<string | null>(null);
    const [status, setStatus] = useState<TrackProcessingStatus | null>(null);
    const pollingRef = useRef<number | null>(null);

    useEffect(() => {
        if (!trackId) return;
        let cancelled = false;
        async function tick() {
            if (cancelled || !trackId) return;
            try {
                const r = await getTrackStatus(trackId);
                setStatus(r.status);
                if (r.status === 'Ready' || r.status === 'Failed') return;
            } catch { /* ignore */ }
            pollingRef.current = window.setTimeout(tick, 3000);
        }
        void tick();
        return () => {
            cancelled = true;
            if (pollingRef.current) window.clearTimeout(pollingRef.current);
        };
    }, [trackId]);

    function pickAudio(f: File | null) {
        setError(null);
        if (!f) { setFile(null); return; }
        if (f.size > MAX_AUDIO_BYTES) { setError('Файл больше 200 МБ.'); setFile(null); return; }
        if (f.type && !ALLOWED_AUDIO.includes(f.type)) { setError(`Тип "${f.type}" не разрешён.`); setFile(null); return; }
        setFile(f);
        if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
    }

    function pickCover(f: File | null) {
        setError(null);
        if (!f) { setCover(null); return; }
        if (f.size > MAX_IMAGE_BYTES) { setError('Обложка больше 10 МБ.'); return; }
        if (!ALLOWED_IMAGE.includes(f.type)) { setError(`Обложка: тип "${f.type}" не разрешён.`); return; }
        setCover(f);
    }

    function toggleGenre(g: string) {
        setGenres((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);
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
            artistId,
            genres,
            featuredArtistIds: featuredArtists.length > 0 ? featuredArtists.map((a) => a.id) : undefined,
            cover: cover ?? undefined,
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

    if (trackId) {
        return (
            <section className="mx-auto max-w-md space-y-4 text-center py-8">
                <h2 className="text-xl font-semibold">Загружено</h2>
                <p className="text-fg-muted">
                    Трек ушёл в обработку. Статус: <span className="text-fg font-medium">{status ?? '...'}</span>.
                </p>
                {status === 'Ready' && (
                    <button
                        onClick={() => navigate(`/tracks/${trackId}`)}
                        className="rounded-lg bg-accent px-4 py-2 text-accent-fg hover:opacity-90 shadow-sm transition-opacity"
                    >
                        Открыть страницу трека
                    </button>
                )}
                {status === 'Failed' && (
                    <p className="text-danger">Обработка упала. Попробуйте ещё раз.</p>
                )}
                {(status === null || status === 'Pending' || status === 'Processing') && (
                    <p className="text-sm text-fg-muted">Опрашиваем статус каждые 3 секунды.</p>
                )}
            </section>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <FilePicker file={file} onPick={pickAudio} disabled={submitting} />

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

            <div className="rounded-xl border border-border bg-bg p-4">
                <CoverPicker
                    file={cover}
                    onPick={pickCover}
                    onClear={() => setCover(null)}
                    disabled={submitting}
                    label="Обложка трека (опционально)"
                    hint="Если не загружать — у трека не будет своей обложки."
                />
            </div>

            <FeaturedArtistsField
                ownArtistId={artistId}
                featuredArtists={featuredArtists}
                setFeaturedArtists={setFeaturedArtists}
                disabled={submitting}
            />

            <GenresField
                genres={genres}
                toggleGenre={toggleGenre}
                genresList={genresList}
                disabled={submitting}
            />

            {submitting && (
                <ProgressBar percent={progress} label={`Загружаем — ${progress}%`} />
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
                type="submit"
                disabled={submitting || !file || !title.trim()}
                className="w-full sm:w-auto rounded-lg bg-accent px-6 py-2.5 font-medium text-accent-fg shadow-sm hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
                {submitting ? 'Загружаем…' : 'Загрузить трек'}
            </button>
        </form>
    );
}

// Album form

interface AlbumProgressEntry {
    id: string;
    title: string;
    state: 'pending' | 'uploading' | 'done' | 'error';
    percent: number;
    error?: string;
    trackId?: string;
}

function AlbumForm({
    artistId,
    genresList,
    navigate,
}: {
    artistId: string;
    genresList: { slug: string; displayName: string; id: string }[];
    navigate: (to: string) => void;
}) {
    const [albumTitle, setAlbumTitle] = useState('');
    const [releaseDate, setReleaseDate] = useState<string>(''); // YYYY-MM-DD
    const [genres, setGenres] = useState<string[]>([]);
    const [albumCover, setAlbumCover] = useState<File | null>(null);

    const [tracks, setTracks] = useState<AlbumTrackEntry[]>([newTrackEntry(), newTrackEntry()]);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progressList, setProgressList] = useState<AlbumProgressEntry[]>([]);
    const [createdAlbumId, setCreatedAlbumId] = useState<string | null>(null);

    function toggleGenre(g: string) {
        setGenres((p) => p.includes(g) ? p.filter((x) => x !== g) : [...p, g]);
    }

    function pickAlbumCover(f: File | null) {
        setError(null);
        if (!f) { setAlbumCover(null); return; }
        if (f.size > MAX_IMAGE_BYTES) { setError('Обложка альбома больше 10 МБ.'); return; }
        if (!ALLOWED_IMAGE.includes(f.type)) { setError(`Обложка: тип "${f.type}" не разрешён.`); return; }
        setAlbumCover(f);
    }

    function updateTrack(id: string, patch: Partial<AlbumTrackEntry>) {
        setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    }

    function addTrack() {
        setTracks((p) => [...p, newTrackEntry()]);
    }

    function removeTrack(id: string) {
        setTracks((p) => (p.length <= 1 ? p : p.filter((t) => t.id !== id)));
    }

    function pickTrackAudio(id: string, f: File | null) {
        if (!f) {
            updateTrack(id, { file: null, fileError: undefined });
            return;
        }
        if (f.size > MAX_AUDIO_BYTES) {
            updateTrack(id, { file: null, fileError: 'Файл больше 200 МБ' });
            return;
        }
        if (f.type && !ALLOWED_AUDIO.includes(f.type)) {
            updateTrack(id, { file: null, fileError: `Тип "${f.type}" не разрешён` });
            return;
        }
        const t = tracks.find((x) => x.id === id);
        const inferredTitle = !t?.title ? f.name.replace(/\.[^.]+$/, '') : t.title;
        updateTrack(id, { file: f, fileError: undefined, title: inferredTitle });
    }

    function pickTrackCover(id: string, f: File | null) {
        if (!f) {
            updateTrack(id, { cover: null, coverError: undefined });
            return;
        }
        if (f.size > MAX_IMAGE_BYTES) {
            updateTrack(id, { coverError: 'Обложка больше 10 МБ' });
            return;
        }
        if (!ALLOWED_IMAGE.includes(f.type)) {
            updateTrack(id, { coverError: `Тип "${f.type}" не разрешён` });
            return;
        }
        updateTrack(id, { cover: f, coverError: undefined });
    }

    function canSubmit(): string | null {
        if (!albumTitle.trim()) return 'Укажите название альбома.';
        const filled = tracks.filter((t) => t.file && t.title.trim());
        if (filled.length === 0) return 'Добавьте хотя бы один трек.';
        if (filled.length !== tracks.length) return 'У некоторых треков не выбран файл или название.';
        return null;
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const err = canSubmit();
        if (err) { setError(err); return; }

        setError(null);
        setSubmitting(true);

        let albumId: string;
        try {
            const album = await createAlbum({
                artistId,
                title: albumTitle.trim(),
                releaseDate: releaseDate || null,
                genres,
            });
            albumId = album.id;
            setCreatedAlbumId(albumId);
        } catch (err: any) {
            const data = err?.response?.data;
            setError(typeof data === 'string' ? data : data?.message ?? 'Не удалось создать альбом.');
            setSubmitting(false);
            return;
        }

        if (albumCover) {
            try {
                await uploadAlbumCover(albumId, albumCover);
            } catch {
            }
        }

        const initialProgress: AlbumProgressEntry[] = tracks.map((t) => ({
            id: t.id,
            title: t.title.trim(),
            state: 'pending',
            percent: 0,
        }));
        setProgressList(initialProgress);

        let allOk = true;
        for (let i = 0; i < tracks.length; i++) {
            const t = tracks[i];
            if (!t.file) continue;

            setProgressList((prev) => prev.map((p) => p.id === t.id ? { ...p, state: 'uploading' } : p));

            try {
                const r = await uploadTrack(t.file, {
                    title: t.title.trim(),
                    artistId,
                    albumId,
                    trackNumber: i + 1,
                    cover: t.cover ?? undefined,
                    featuredArtistIds: t.featuredArtists.length > 0
                        ? t.featuredArtists.map((a) => a.id)
                        : undefined,
                }, (pct) => {
                    setProgressList((prev) => prev.map((p) => p.id === t.id ? { ...p, percent: pct } : p));
                });
                setProgressList((prev) => prev.map((p) =>
                    p.id === t.id ? { ...p, state: 'done', percent: 100, trackId: r.trackId } : p,
                ));
            } catch (err: any) {
                allOk = false;
                const data = err?.response?.data;
                const msg = typeof data === 'string' ? data : data?.message ?? 'Не удалось загрузить трек';
                setProgressList((prev) => prev.map((p) =>
                    p.id === t.id ? { ...p, state: 'error', error: msg } : p,
                ));
            }
        }

        if (!allOk) {
            setError('Часть треков не загрузилась — см. ошибки рядом со строками. Альбом всё равно создан.');
        }
        setSubmitting(false);
    }

    if (createdAlbumId && progressList.length > 0 && progressList.every((p) => p.state === 'done')) {
        return (
            <section className="space-y-4 rounded-xl border border-border bg-bg-elevated p-8 text-center shadow-sm">
                <h2 className="text-xl font-semibold">Альбом загружен</h2>
                <p className="text-fg-muted">
                    Все {progressList.length} треков ушли в обработку (HLS-транскод запустится автоматически).
                </p>
                <button
                    onClick={() => navigate(`/albums/${createdAlbumId}`)}
                    className="rounded-lg bg-accent px-4 py-2 text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
                >
                    Открыть страницу альбома
                </button>
            </section>
        );
    }

    return (
        <form onSubmit={onSubmit} className="space-y-8">
            <fieldset className="space-y-5 rounded-xl border border-border bg-bg p-5 shadow-sm">
                <legend className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">Настройки альбома</legend>

                <Field label="Название альбома *">
                    <input
                        type="text"
                        required
                        maxLength={200}
                        value={albumTitle}
                        onChange={(e) => setAlbumTitle(e.target.value)}
                        disabled={submitting}
                        className={inputClass}
                    />
                </Field>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field label="Дата релиза">
                        <input
                            type="date"
                            value={releaseDate}
                            onChange={(e) => setReleaseDate(e.target.value)}
                            disabled={submitting}
                            className={inputClass}
                        />
                    </Field>
                    <div className="rounded-xl border border-border bg-bg-elevated p-3">
                        <CoverPicker
                            file={albumCover}
                            onPick={pickAlbumCover}
                            onClear={() => setAlbumCover(null)}
                            disabled={submitting}
                            label="Обложка альбома"
                            hint="Будет наследоваться всеми треками."
                        />
                    </div>
                </div>

                <GenresField
                    genres={genres}
                    toggleGenre={toggleGenre}
                    genresList={genresList}
                    disabled={submitting}
                />
            </fieldset>

            <fieldset className="space-y-4 rounded-xl border border-border bg-bg p-5 shadow-sm">
                <legend className="px-2 text-sm font-semibold tracking-wide text-fg-muted uppercase">
                    Треки ({tracks.length})
                </legend>

                <ul className="space-y-4">
                    {tracks.map((t, i) => {
                        const progress = progressList.find((p) => p.id === t.id);
                        return (
                            <li key={t.id} className="rounded-xl border border-border bg-bg-elevated p-4 shadow-sm transition-all hover:border-accent/40">
                                <div className="flex items-start gap-4">
                                    <span className="mt-2.5 w-6 shrink-0 text-center text-sm font-medium text-fg-muted bg-bg rounded-md py-1">{i + 1}</span>
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                onChange={(e) => pickTrackAudio(t.id, e.target.files?.[0] ?? null)}
                                                disabled={submitting}
                                                className="text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-fg file:font-medium file:transition-colors file:hover:bg-accent/10"
                                            />
                                            {t.file && (
                                                <span className="truncate text-xs font-medium text-accent">
                                                    {(t.file.size / 1024 / 1024).toFixed(1)} МБ
                                                </span>
                                            )}
                                        </div>
                                        {t.fileError && <p className="text-xs text-danger">{t.fileError}</p>}

                                        <input
                                            type="text"
                                            placeholder="Название трека *"
                                            maxLength={200}
                                            value={t.title}
                                            onChange={(e) => updateTrack(t.id, { title: e.target.value })}
                                            disabled={submitting}
                                            className={cn(inputClass, 'py-2 text-sm')}
                                        />

                                        <div className="flex flex-wrap items-center gap-4 bg-bg rounded-lg p-2 border border-border">
                                            <label className="flex cursor-pointer items-center gap-2 text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={!t.cover}
                                                    onChange={(e) => {
                                                        if (e.target.checked) pickTrackCover(t.id, null);
                                                    }}
                                                    disabled={submitting}
                                                    className="rounded border-border bg-bg-elevated text-accent focus:ring-accent"
                                                />
                                                <span className="text-fg">Обложка альбома</span>
                                            </label>
                                            {!t.cover && (
                                                <span className="text-xs text-fg-muted">— или —</span>
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => pickTrackCover(t.id, e.target.files?.[0] ?? null)}
                                                disabled={submitting}
                                                className="text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-bg-elevated file:px-3 file:py-1 file:text-fg file:hover:bg-accent/10 transition-colors"
                                            />
                                            {t.cover && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg bg-bg-elevated px-2 py-1 rounded-md border border-border">
                                                    {t.cover.name}
                                                    <button
                                                        type="button"
                                                        onClick={() => pickTrackCover(t.id, null)}
                                                        disabled={submitting}
                                                        className="text-fg-muted hover:text-danger ml-1"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            )}
                                        </div>
                                        {t.coverError && <p className="text-xs text-danger">{t.coverError}</p>}

                                        <FeaturedArtistsField
                                            ownArtistId={artistId}
                                            featuredArtists={t.featuredArtists}
                                            setFeaturedArtists={(v) => updateTrack(t.id, { featuredArtists: v })}
                                            disabled={submitting}
                                            compact
                                        />

                                        {progress && progress.state !== 'pending' && (
                                            <div className="space-y-1 pt-2">
                                                {progress.state === 'uploading' && (
                                                    <ProgressBar percent={progress.percent} label={`Загрузка — ${progress.percent}%`} />
                                                )}
                                                {progress.state === 'done' && (
                                                    <p className="text-xs font-medium text-success">✓ Загружен, ID: {progress.trackId?.slice(0, 8)}…</p>
                                                )}
                                                {progress.state === 'error' && (
                                                    <p className="text-xs font-medium text-danger">✗ {progress.error}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeTrack(t.id)}
                                        disabled={submitting || tracks.length <= 1}
                                        title="Удалить трек из списка"
                                        className="p-1.5 rounded-md text-fg-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30 transition-colors"
                                    >
                                        ×
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>

                <button
                    type="button"
                    onClick={addTrack}
                    disabled={submitting}
                    className="w-full rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-fg-muted hover:border-accent hover:text-accent disabled:opacity-50 transition-colors bg-bg"
                >
                    + Добавить еще трек
                </button>
            </fieldset>

            {error && <p className="text-sm font-medium text-danger bg-danger/10 p-3 rounded-lg border border-danger/20">{error}</p>}

            <button
                type="submit"
                disabled={submitting || !!canSubmit()}
                className="w-full sm:w-auto rounded-lg bg-accent px-6 py-3 font-medium text-accent-fg shadow-sm hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
                {submitting ? 'Загружаем альбом…' : `Загрузить альбом (${tracks.length} тр.)`}
            </button>
        </form>
    );
}

// Featured artists — поиск по каталогу артистов

function FeaturedArtistsField({
    ownArtistId,
    featuredArtists,
    setFeaturedArtists,
    disabled,
    compact = false,
}: {
    ownArtistId: string;
    featuredArtists: { id: string; name: string }[];
    setFeaturedArtists: (v: { id: string; name: string }[]) => void;
    disabled?: boolean;
    compact?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ArtistSummary[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const found = await searchArtists(query);
                setResults(found);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, [query]);

    const visible = results
        .filter((a) => a.id !== ownArtistId)                          // не себя
        .filter((a) => !featuredArtists.some((x) => x.id === a.id));  // не уже добавленных

    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
            <span className={cn('block font-medium text-fg-muted', compact ? 'text-xs' : 'text-sm')}>
                Доп. исполнители (feat.)
            </span>

            {featuredArtists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {featuredArtists.map((a) => (
                        <span
                            key={a.id}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 text-accent font-medium',
                                compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
                            )}
                        >
                            {a.name}
                            <button
                                type="button"
                                onClick={() => setFeaturedArtists(featuredArtists.filter((x) => x.id !== a.id))}
                                disabled={disabled}
                                className="text-fg-muted hover:text-danger transition-colors"
                                aria-label={`Убрать ${a.name}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className={cn('relative', compact ? '' : 'max-w-md')}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={compact ? 'Поиск feat.-артиста…' : 'Поиск артистов в каталоге…'}
                    disabled={disabled}
                    className={cn(inputClass, compact && 'py-1.5 text-xs')}
                />
                {searching && <p className="mt-1 text-xs text-fg-muted">Поиск…</p>}
                {query.trim().length >= 2 && !searching && visible.length === 0 && (
                    <p className="mt-1.5 text-xs text-fg-muted bg-bg p-2 rounded-md border border-border">
                        Никого не нашли. Featured-исполнители должны иметь свой профиль артиста в каталоге.
                    </p>
                )}
                {visible.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-bg-elevated shadow-lg overflow-hidden">
                        {visible.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-bg transition-colors">
                                <div className="flex min-w-0 items-center gap-3">
                                    {a.avatarUrl && (
                                        <img
                                            src={a.avatarUrl}
                                            alt=""
                                            className="size-7 shrink-0 rounded-full object-cover ring-1 ring-border"
                                        />
                                    )}
                                    <span className="truncate text-sm font-medium">{a.name}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFeaturedArtists([...featuredArtists, { id: a.id, name: a.name }]);
                                        setQuery('');
                                        setResults([]);
                                    }}
                                    className="rounded-md bg-accent/10 text-accent px-3 py-1 text-xs font-medium hover:bg-accent hover:text-accent-fg transition-colors"
                                >
                                    Добавить
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function GenresField({
    genres,
    toggleGenre,
    genresList,
    disabled,
}: {
    genres: string[];
    toggleGenre: (slug: string) => void;
    genresList: { slug: string; displayName: string; id: string }[];
    disabled?: boolean;
}) {
    return (
        <div>
            <span className="mb-2 block text-sm font-medium text-fg-muted">Жанры</span>
            <div className="flex flex-wrap gap-2">
                {genresList.map((g) => {
                    const selected = genres.includes(g.slug);
                    return (
                        <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleGenre(g.slug)}
                            disabled={disabled}
                            className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                                selected
                                    ? 'border-accent bg-accent text-accent-fg shadow-sm'
                                    : 'border-border bg-bg text-fg hover:border-accent/50',
                            )}
                        >
                            {g.displayName}
                        </button>
                    );
                })}
            </div>
            {genres.length > 0 && (
                <p className="mt-3 text-xs font-medium text-fg-muted">Выбрано: <span className="text-fg">{genres.join(', ')}</span></p>
            )}
        </div>
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
        <div className="rounded-xl border-2 border-dashed border-border bg-bg p-8 text-center transition-colors hover:border-accent/50">
            {file ? (
                <div className="space-y-3 text-sm">
                    <p className="font-medium text-lg text-fg">{file.name}</p>
                    <p className="text-fg-muted bg-bg-elevated inline-block px-3 py-1 rounded-md border border-border">
                        {file.type || 'unknown'} • {(file.size / 1024 / 1024).toFixed(1)} МБ
                    </p>
                    <div>
                        <button
                            type="button"
                            onClick={() => onPick(null)}
                            disabled={disabled}
                            className="mt-2 text-sm font-medium text-fg-muted underline hover:text-accent transition-colors disabled:opacity-50"
                        >
                            Заменить файл
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="mx-auto size-12 bg-bg-elevated rounded-full flex items-center justify-center mb-3">
                        <span className="text-xl text-fg-muted">+</span>
                    </div>
                    <p className="text-sm font-medium text-fg-muted mb-4">Перетащи аудиофайл сюда или</p>
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={disabled}
                        className="rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-fg hover:border-accent transition-colors disabled:opacity-50"
                    >
                        Выбрать файл
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

function CoverPicker({
    file,
    onPick,
    onClear,
    disabled,
    label,
    hint,
}: {
    file: File | null;
    onPick: (f: File | null) => void;
    onClear: () => void;
    disabled?: boolean;
    label: string;
    hint?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const previewUrl = file ? URL.createObjectURL(file) : null;
    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    return (
        <div className="space-y-2">
            <span className="block text-sm font-medium text-fg-muted">{label}</span>
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="size-24 shrink-0 rounded-xl border border-dashed border-border bg-bg bg-cover bg-center transition-colors hover:border-accent disabled:opacity-50 flex items-center justify-center overflow-hidden"
                    style={{ backgroundImage: previewUrl ? `url(${previewUrl})` : undefined }}
                >
                    {!previewUrl && <span className="text-xs font-medium text-fg-muted text-center leading-tight px-2">+ Загрузить</span>}
                </button>
                <div className="text-sm">
                    {file ? (
                        <div className="space-y-1">
                            <p className="text-fg font-medium line-clamp-1">{file.name}</p>
                            <button
                                type="button"
                                onClick={onClear}
                                disabled={disabled}
                                className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                            >
                                Удалить обложку
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs text-fg-muted block max-w-[200px]">{hint}</span>
                    )}
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
            </div>
        </div>
    );
}

function ProgressBar({ percent, label }: { percent: number; label?: string }) {
    return (
        <div className="space-y-1.5 pt-2">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg border border-border">
                <div
                    className="h-full bg-accent transition-[width] duration-300 ease-out"
                    style={{ width: `${percent}%` }}
                />
            </div>
            {label && <p className="text-xs font-medium text-fg-muted text-right">{label}</p>}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg-muted">{label}</span>
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50';