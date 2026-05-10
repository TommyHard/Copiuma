import { Tooltip } from '@/shared/ui/Tooltip';
import { useTheme } from './useTheme';
import { SunIcon, MoonIcon } from '@/shared/ui/icons';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    function toggle() {
        setTheme(theme === 'light' ? 'dark' : 'light');
    }

    const isLight = theme === 'light';
    const Icon = isLight ? SunIcon : MoonIcon;

    const tooltipText = isLight ? 'Включить тёмную тему' : 'Включить светлую тему';

    return (
        <Tooltip content={tooltipText} position="bottom">
            <button
                onClick={toggle}
                aria-label="Переключить тему"
                className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-accent/20 hover:text-fg"
            >
                <Icon className="h-6 w-6" aria-hidden="true" />
            </button>
        </Tooltip>
    );
}