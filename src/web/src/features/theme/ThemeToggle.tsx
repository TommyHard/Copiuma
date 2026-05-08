import { useTheme } from './useTheme';
import { SunIcon, MoonIcon } from '@/shared/ui/icons';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    function toggle() {
        setTheme(theme === 'light' ? 'dark' : 'light');
    }

    const isLight = theme === 'light';
    const Icon = isLight ? SunIcon : MoonIcon;

    return (
        <button
            onClick={toggle}
            title={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
            aria-label="Переключить тему"

            className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-accent/20 hover:text-fg"
        >
            <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
    );
}