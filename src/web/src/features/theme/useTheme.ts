import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'copiuma.theme';

let listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

function getSnapshot(): Theme {
    return ((localStorage.getItem(KEY) as Theme | null) ?? 'system');
}

function notify() {
    for (const cb of listeners) cb();
}

export function setTheme(t: Theme) {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
    applyToDom();
    notify();
}

function applyToDom() {
    const stored = (localStorage.getItem(KEY) as 'light' | 'dark' | null);
    const effective: 'light' | 'dark' = stored
        ?? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = effective;
}

/**
 * Хук возвращает выбор пользователя
 * Сразу при монтировании — синхронизирует data-theme на <html>
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
    const theme = useSyncExternalStore(subscribe, getSnapshot, () => 'system');

    useEffect(() => {
        applyToDom();

        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const onChange = () => {
            if (!localStorage.getItem(KEY)) applyToDom();
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [theme]);

    return { theme, setTheme };
}