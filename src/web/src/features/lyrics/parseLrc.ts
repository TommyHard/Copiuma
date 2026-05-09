export interface LyricLine {
    /** Время начала строки в секундах */
    time: number;
    /** Текст строки */
    text: string;
}

const TS_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/**
 * Парсит LRC формат
 *   [00:13.45] we rot inside the ground
 *
 * Возвращает строки, отсортированные по времени.
 */
export function parseLrc(raw: string): LyricLine[] {
    if (!raw) return [];
    const lines = raw.split(/\r?\n/);
    const out: LyricLine[] = [];

    for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) continue;

        if (/^\[[a-zA-Z]{2,}:[^\]]*\]\s*$/.test(line)) continue;

        TS_RE.lastIndex = 0;
        const stamps: number[] = [];
        let match: RegExpExecArray | null;
        let lastEnd = 0;
        while ((match = TS_RE.exec(line)) !== null) {
            const m = parseInt(match[1], 10);
            const s = parseInt(match[2], 10);
            const fracRaw = match[3] ?? '0';
            const frac = fracRaw.length === 0
                ? 0
                : parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length);
            const t = m * 60 + s + frac;
            if (Number.isFinite(t)) stamps.push(t);
            lastEnd = match.index + match[0].length;
        }

        if (stamps.length === 0) continue;
        const text = line.slice(lastEnd).trim();
        for (const t of stamps) {
            out.push({ time: t, text });
        }
    }

    out.sort((a, b) => a.time - b.time);
    return out;
}

/**
 * Поиск активной строки по текущему времени
 * Возвращает индекс строки, чье time <= currentTime, или -1
 */
export function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
    if (lines.length === 0) return -1;
    if (currentTime < lines[0].time) return -1;

    let lo = 0;
    let hi = lines.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid].time <= currentTime) lo = mid + 1;
        else hi = mid - 1;
    }
    return Math.max(0, lo - 1);
}
