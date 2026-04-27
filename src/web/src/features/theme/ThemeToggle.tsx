import { setTheme, useTheme } from './useTheme';

/**
 * Минимальный 3-state toggle: light / system / dark
 */
export function ThemeToggle() {
    const { theme } = useTheme();

    function next() {
        setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system');
    }

    const label = theme === 'system' ? 'Авто' : theme === 'light' ? 'Светлая' : 'Тёмная';
    const icon = theme === 'system' ? '🌓' : theme === 'light' ? '☀' : '☾';

    return (
        <button
            onClick={next}
            title={`Тема: ${label}`}
            className="flex h-9 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-bg-elevated"
        >
            <span aria-hidden>{icon}</span>
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}