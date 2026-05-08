import { useEffect, useRef, useState } from 'react';
import { usePlayer, type SleepMode } from './store';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60, 90];

function MoonZIcon({ className, active }: { className?: string; active?: boolean }) {
    return (
        <div className={cn("relative flex items-center justify-center w-6 h-6", className)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            {active && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
            )}
        </div>
    );
}

function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SleepTimerButton() {
    const sleepTimer = usePlayer((s) => s.sleepTimer);
    const setSleepTimer = usePlayer((s) => s.setSleepTimer);
    const cancelSleepTimer = usePlayer((s) => s.cancelSleepTimer);

    const [isOpen, setIsOpen] = useState(false);
    const [customMinutes, setCustomMinutes] = useState('20');
    const [tick, setTick] = useState(0);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const isActive = !!sleepTimer;

    useEffect(() => {
        if (sleepTimer?.mode !== 'timer' || !sleepTimer.deadlineMs) return;
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [sleepTimer?.mode, sleepTimer?.deadlineMs]);

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

    function applyMode(mode: SleepMode, minutes?: number) {
        if (mode === 'timer') {
            const m = Math.max(1, Math.round(minutes ?? 0));
            setSleepTimer({ mode: 'timer', deadlineMs: Date.now() + m * 60 * 1000 });
        } else {
            setSleepTimer({ mode, deadlineMs: null });
        }
        setIsOpen(false);
    }

    let summary = 'Таймер сна';
    if (sleepTimer?.mode === 'after-track') summary = 'После трека';
    else if (sleepTimer?.mode === 'after-queue') summary = 'После очереди';
    else if (sleepTimer?.mode === 'timer' && sleepTimer.deadlineMs) {
        summary = `Через ${formatRemaining(sleepTimer.deadlineMs - Date.now())}`;
    }

    return (
        <div className="relative">
            <Tooltip content={summary} position="top">
                <button
                    ref={buttonRef}
                    onClick={() => setIsOpen((v) => !v)}
                    className={cn(
                        "relative transition-transform duration-200 hover:scale-105 active:scale-100",
                        isActive ? "text-accent" : "text-fg-muted hover:text-fg"
                    )}
                    aria-label="Таймер сна"
                >
                    <MoonZIcon active={isActive} />
                </button>
            </Tooltip>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute bottom-full mb-3 right-0 z-[9999] w-72 rounded-xl border border-border bg-bg-elevated shadow-xl p-3 animate-in fade-in zoom-in-95 duration-100"
                >
                    <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs uppercase tracking-wider font-bold text-fg-muted">Таймер сна</span>
                        {isActive && (
                            <button
                                onClick={() => { cancelSleepTimer(); setIsOpen(false); }}
                                className="text-[11px] text-accent hover:underline"
                            >
                                Сбросить
                            </button>
                        )}
                    </div>

                    {sleepTimer?.mode === 'timer' && sleepTimer.deadlineMs && (
                        <div className="mx-1 mb-2 rounded bg-accent/10 border border-accent/30 px-3 py-2 text-xs text-fg">
                            Пауза через <span className="font-bold tabular-nums">{formatRemaining(sleepTimer.deadlineMs - Date.now())}</span>
                            <span className="hidden">{tick}</span>
                        </div>
                    )}

                    <div className="space-y-1">
                        <button
                            onClick={() => applyMode('after-track')}
                            className={cn(
                                "w-full text-left rounded px-3 py-2 text-sm hover:bg-fg/5 transition-colors flex items-center justify-between",
                                sleepTimer?.mode === 'after-track' && "bg-accent/10 text-accent"
                            )}
                        >
                            <span>Поставить на паузу после трека</span>
                            {sleepTimer?.mode === 'after-track' && <span className="text-[10px] uppercase tracking-wide">вкл</span>}
                        </button>
                        <button
                            onClick={() => applyMode('after-queue')}
                            className={cn(
                                "w-full text-left rounded px-3 py-2 text-sm hover:bg-fg/5 transition-colors flex items-center justify-between",
                                sleepTimer?.mode === 'after-queue' && "bg-accent/10 text-accent"
                            )}
                        >
                            <span>После окончания очереди</span>
                            {sleepTimer?.mode === 'after-queue' && <span className="text-[10px] uppercase tracking-wide">вкл</span>}
                        </button>
                    </div>

                    <div className="my-3 border-t border-border" />

                    <div className="px-1">
                        <div className="text-[11px] uppercase tracking-wider font-bold text-fg-muted mb-2">Через время</div>
                        <div className="grid grid-cols-4 gap-1.5 mb-2">
                            {PRESET_MINUTES.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => applyMode('timer', m)}
                                    className="text-xs rounded border border-border px-2 py-1.5 hover:bg-accent/10 hover:border-accent transition-colors"
                                >
                                    {m} мин
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={720}
                                value={customMinutes}
                                onChange={(e) => setCustomMinutes(e.target.value)}
                                className="flex-1 rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent"
                                placeholder="Минут"
                            />
                            <button
                                onClick={() => {
                                    const n = parseInt(customMinutes, 10);
                                    if (Number.isFinite(n) && n > 0) applyMode('timer', n);
                                }}
                                className="rounded bg-accent text-accent-fg text-xs px-3 py-1.5 hover:opacity-90"
                            >
                                Установить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}