import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWaveform } from '@/shared/api/catalog';

/**
 * Waveform-canvas: рисует двусторонние пики (mirrored top/bottom) из массива
 * peaks (значения 0-1)
 */
export function Waveform({ trackId, className }: { trackId: string; className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const q = useQuery({
        queryKey: ['waveform', trackId],
        queryFn: () => getWaveform(trackId),
        retry: 0,
    });

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || !q.data) return;
        const peaks = q.data.peaks;
        drawWaveform(canvas, peaks);

        const ro = new ResizeObserver(() => drawWaveform(canvas, peaks));
        ro.observe(canvas);
        return () => ro.disconnect();
    }, [q.data]);

    if (q.isLoading) return <div className={className}>Загружаем волну…</div>;
    if (q.isError) return <div className={className}>Waveform ещё не готов.</div>;
    if (!q.data) return null;

    return <canvas ref={ref} className={className ?? 'h-24 w-full'} />;
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: number[]) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;

    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    if (peaks.length === 0) return;

    const middle = cssH / 2;
    const barCount = Math.min(peaks.length, Math.floor(cssW / 2));
    const step = peaks.length / barCount;
    const barWidth = cssW / barCount;
    const barGap = barWidth * 0.4;
    const barCore = barWidth - barGap;

    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '124 92 255';
    ctx.fillStyle = `rgba(255, 255, 255, 0.8)`;

    for (let i = 0; i < barCount; i++) {
        const slice = peaks.slice(Math.floor(i * step), Math.floor((i + 1) * step));
        const peak = slice.length === 0 ? 0 : Math.max(...slice);
        const h = Math.max(1, peak * (cssH * 0.95));
        const x = i * barWidth + barGap / 2;
        ctx.fillRect(x, middle - h / 2, barCore, h);
    }
}