import { cn } from '@/shared/lib/cn';

/**
 * Обложка плейлиста:
 *   1. Если задан явный coverUrl — используем
 *   2. Иначе собираем композит из previewCovers (1, 2 или 4 плитки)
 *   3. Если ничего нет — пустой плейсхолдер
 */
export function PlaylistCover({
    coverUrl,
    previewCovers,
    className,
    rounded = 'md',
}: {
    coverUrl?: string | null;
    previewCovers?: string[];
    className?: string;
    rounded?: 'md' | 'lg' | 'none';
}) {
    const radius =
        rounded === 'lg' ? 'rounded-lg' :
            rounded === 'md' ? 'rounded-md' :
                '';

    if (coverUrl) {
        return (
            <div
                className={cn('bg-bg-elevated bg-cover bg-center', radius, className)}
                style={{ backgroundImage: `url(${coverUrl})` }}
                aria-hidden
            />
        );
    }

    const tiles = (previewCovers ?? []).slice(0, 4);

    if (tiles.length === 0) {
        return (
            <div
                className={cn('bg-bg-elevated', radius, className)}
                aria-hidden
            />
        );
    }

    if (tiles.length === 1) {
        return (
            <div
                className={cn('bg-bg-elevated bg-cover bg-center', radius, className)}
                style={{ backgroundImage: `url(${tiles[0]})` }}
                aria-hidden
            />
        );
    }

    if (tiles.length === 2) {
        return (
            <div
                className={cn('grid grid-cols-2 overflow-hidden bg-bg-elevated', radius, className)}
                aria-hidden
            >
                {tiles.map((url, i) => (
                    <div
                        key={i}
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${url})` }}
                    />
                ))}
            </div>
        );
    }

    if (tiles.length === 3) {
        return (
            <div
                className={cn('grid grid-cols-2 grid-rows-2 overflow-hidden bg-bg-elevated', radius, className)}
                aria-hidden
            >
                <div
                    className="row-span-2 bg-cover bg-center"
                    style={{ backgroundImage: `url(${tiles[0]})` }}
                />
                <div
                    className="bg-cover bg-center"
                    style={{ backgroundImage: `url(${tiles[1]})` }}
                />
                <div
                    className="bg-cover bg-center"
                    style={{ backgroundImage: `url(${tiles[2]})` }}
                />
            </div>
        );
    }

    return (
        <div
            className={cn('grid grid-cols-2 grid-rows-2 overflow-hidden bg-bg-elevated', radius, className)}
            aria-hidden
        >
            {tiles.map((url, i) => (
                <div
                    key={i}
                    className="bg-cover bg-center"
                    style={{ backgroundImage: `url(${url})` }}
                />
            ))}
        </div>
    );
}