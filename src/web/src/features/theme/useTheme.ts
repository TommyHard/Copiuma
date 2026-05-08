import { useEffect, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'copiuma.theme';

let listeners = new Set<() => void>();

function subscribe(cb: () => void) {
    listeners.add(cb);

    const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
            applyToDom();
            cb();
        }
    };
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
    };
}

function getSnapshot(): Theme {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function notify() {
    for (const cb of listeners) cb();
}

export function setTheme(t: Theme) {
    localStorage.setItem(KEY, t);
    applyToDom(t);
    notify();
}

function applyToDom(forcedTheme?: Theme) {
    const theme = forcedTheme ?? getSnapshot();
    document.documentElement.dataset.theme = theme;
}

export function useTheme() {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    useEffect(() => {
        applyToDom();

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            if (!localStorage.getItem(KEY)) {
                applyToDom();
                notify();
            }
        };

        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    return { theme, setTheme };
}