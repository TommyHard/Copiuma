import { useEffect, useRef, useState, useMemo } from 'react';
import { usePlayer, EQ_PRESETS } from './store';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';
import { EqualizerIcon } from '@/shared/ui/icons';

const PRESETS: { key: keyof typeof EQ_PRESETS; label: string }[] = [
    { key: 'flat', label: 'Плоский' },
    { key: 'bass', label: 'Бас' },
    { key: 'vocal', label: 'Вокал' },
    { key: 'treble', label: 'ВЧ' },
    { key: 'rock', label: 'Рок' },
    { key: 'pop', label: 'Поп' },
    { key: 'jazz', label: 'Джаз' },
];

function EqIcon({ active }: { active?: boolean }) {
    return (
        <div className="relative flex items-center justify-center w-6 h-6">
            <EqualizerIcon className="w-5 h-5" />
            {active && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
            )}
        </div>
    );
}

function freqLabel(freq: number): string {
    if (freq >= 1000) return `${freq / 1000}K`;
    return `${freq}`;
}

export function EqualizerButton() {
    const equalizer = usePlayer((s) => s.equalizer);
    const setEnabled = usePlayer((s) => s.setEqualizerEnabled);
    const setBand = usePlayer((s) => s.setEqualizerBand);
    const setPreamp = usePlayer((s) => s.setEqualizerPreamp);
    const applyPreset = usePlayer((s) => s.applyEqualizerPreset);

    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        function onDoc(e: MouseEvent) {
            const target = e.target as Node;
            if (popoverRef.current?.contains(target)) return;
            if (buttonRef.current?.contains(target)) return;
            setIsOpen(false);
        }
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [isOpen]);

    return (
        <div className="relative">
            <Tooltip content={equalizer.enabled ? 'Эквалайзер включён' : 'Эквалайзер'} position="top">
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen((v) => !v)}
                    className={cn(
                        "relative transition-transform duration-200 hover:scale-105 active:scale-100",
                        equalizer.enabled ? "text-accent" : "text-fg-muted hover:text-fg"
                    )}
                    aria-label="Эквалайзер"
                >
                    <EqIcon active={equalizer.enabled} />
                </button>
            </Tooltip>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full mb-3 right-0 z-[9999] w-max max-w-[90vw] rounded-xl border border-border bg-bg-elevated shadow-xl p-4 animate-in fade-in zoom-in-95 duration-100"
                >
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs uppercase tracking-wider font-bold text-fg-muted">Эквалайзер</span>
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={equalizer.enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <span className="relative inline-flex h-5 w-9 items-center rounded-full bg-fg/15 peer-checked:bg-accent transition-colors">
                                <span className="inline-block h-4 w-4 rounded-full bg-white shadow translate-x-0.5 peer-checked:translate-x-[18px] transition-transform" />
                            </span>
                            <span className="text-xs text-fg-muted">{equalizer.enabled ? 'Вкл' : 'Выкл'}</span>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mb-5">
                        {PRESETS.map((p) => (
                            <button
                                key={p.key}
                                onClick={() => applyPreset(p.key)}
                                className="text-[11px] rounded-md border border-border px-2 py-1 hover:bg-accent/10 hover:border-accent transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={() => {
                                applyPreset('flat');
                                setPreamp(0);
                            }}
                            className="text-[11px] rounded-md border border-border px-2 py-1 text-fg-muted hover:text-accent hover:border-accent transition-colors ml-auto"
                        >
                            Сброс
                        </button>
                    </div>

                    <div className={cn(
                        "flex items-start justify-between gap-4",
                        !equalizer.enabled && "opacity-40 pointer-events-none grayscale-[0.5]"
                    )}>
                        {/* Preamp */}
                        <BandSlider label="Pre" value={equalizer.preamp} onChange={setPreamp} />

                        <div className="w-px h-[130px] bg-border self-center" />

                        {/* Hz */}
                        <div className="flex flex-col items-center">
                            <div className="h-4" />
                            <EqGraph bands={equalizer.bands} setBand={setBand} width={360} height={100} />
                            <div className="h-4" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BandSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div className="flex flex-col items-center gap-1.5 min-w-[32px]">
            <span className="text-[10px] tabular-nums font-medium text-fg-muted h-4 flex items-center">
                {value > 0 ? '+' : ''}{value.toFixed(0)}
            </span>
            <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="vertical-eq-slider"
                style={{
                    writingMode: 'vertical-lr' as any,
                    direction: 'rtl',
                    width: 16,
                    height: 100,
                    accentColor: 'rgb(var(--accent))',
                    cursor: 'pointer'
                }}
            />
            <span className="text-[10px] font-bold text-fg-muted h-4 flex items-center uppercase tracking-tighter">
                {label}
            </span>
        </div>
    );
}

interface EqGraphProps {
    bands: { freq: number; gain: number }[];
    setBand: (index: number, value: number) => void;
    width: number;
    height: number;
}

function EqGraph({ bands, setBand, width, height }: EqGraphProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

    const FREQS = [60, 150, 400, 1000, 2400, 15000];
    const MARGIN_X = 20;

    const points = useMemo(() => {
        return bands.map((band, i) => {
            const x = MARGIN_X + (i / (bands.length - 1)) * (width - 2 * MARGIN_X);
            const y = height - ((band.gain + 12) / 24) * height;
            return { x, y, index: i, band };
        });
    }, [bands, width, height]);

    const linePath = useMemo(() => {
        if (points.length < 2) return '';
        let path = `M${points[0].x},${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const cp1x = p1.x + (p2.x - p1.x) / 3;
            const cp2x = p1.x + (2 * (p2.x - p1.x)) / 3;
            path += ` C${cp1x},${p1.y} ${cp2x},${p2.y} ${p2.x},${p2.y}`;
        }
        return path;
    }, [points]);

    const fillPath = useMemo(() => {
        if (!linePath) return '';
        return `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;
    }, [linePath, points, height]);

    const handleMouseDown = (index: number) => setDraggingPointIndex(index);

    useEffect(() => {
        if (draggingPointIndex === null) return;
        const onMouseMove = (e: MouseEvent) => {
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            let normalizedY = (e.clientY - rect.top) / height;
            normalizedY = Math.max(0, Math.min(1, normalizedY));
            const gain = 12 - normalizedY * 24;
            setBand(draggingPointIndex, Math.round(gain * 2) / 2);
        };
        const onMouseUp = () => setDraggingPointIndex(null);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [draggingPointIndex, setBand, height]);

    return (
        <div className="relative">
            <svg ref={svgRef} width={width} height={height} className="select-none overflow-visible">
                <defs>
                    <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Сетка */}
                <line x1={0} y1={height / 2} x2={width} y2={height / 2} className="stroke-border" strokeWidth={1} strokeDasharray="4 4" />
                {points.map((p, i) => (
                    <line key={`grid-${i}`} x1={p.x} y1={0} x2={p.x} y2={height} className="stroke-border/50" strokeWidth={1} />
                ))}

                <path d={fillPath} fill="url(#eqGradient)" />
                <path d={linePath} fill="none" className="stroke-accent" strokeWidth={2.5} />

                {/* Значения полос */}
                {points.map((p, i) => (
                    <text
                        key={`val-${i}`}
                        x={p.x}
                        y={-12}
                        textAnchor="middle"
                        fill="currentColor"
                        className={cn(
                            "text-[10px] tabular-nums font-medium pointer-events-none select-none transition-colors duration-150",
                            draggingPointIndex === i ? "text-fg" : "text-fg-muted"
                        )}
                    >
                        {p.band.gain > 0 ? '+' : ''}{p.band.gain}
                    </text>
                ))}

                {/* Точки-хэндлы */}
                {points.map((p, i) => (
                    <circle
                        key={`handle-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={6}
                        className="fill-accent cursor-ns-resize shadow-sm hover:fill-accent transition-colors"
                        onMouseDown={() => handleMouseDown(i)}
                    />
                ))}
            </svg>

            <div className="flex justify-between mt-1.5" style={{ paddingLeft: MARGIN_X, paddingRight: MARGIN_X }}>
                {FREQS.map((f) => (
                    <span key={f} className="text-[9px] text-fg-muted font-medium w-0 flex justify-center whitespace-nowrap">
                        {freqLabel(f)}Hz
                    </span>
                ))}
            </div>
        </div>
    );
}