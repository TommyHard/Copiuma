import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { useUIStore } from '@/shared/store/uiStore';
import { usePlayer } from '@/features/player/store';
import { setTheme as applyTheme, type Theme } from '@/features/theme/useTheme';
import { getUserState, putUserState } from '@/shared/api/userState';

/**
 * Кросс-девайсная синхронизация пользовательского состояния:
 *  - тема (theme)
 *  - размеры/состояние сайдбаров (leftWidth, rightWidth, isLeftOpen, isRightOpen)
 *  - последний играющий трек / позиция / громкость / shuffle / repeat
 *
 * Поведение:
 *  1. На вход в аккаунт — pull серверного state, заполняем
 *  2. После заполнения — подписываемся на изменения и пуш обновления
 *     с дебаунсом, пишем последнее по версии
 *
 * Локальный localStorage не торкаем - он остаётся до момента
 * пока сервер не успеет ответить
 */

interface SyncedState {
    theme?: Theme;
    ui?: {
        leftWidth?: number;
        rightWidth?: number;
        isLeftOpen?: boolean;
        isRightOpen?: boolean;
        rightTab?: 'queue' | 'friends' | 'now-playing';
    };
    player?: {
        queueIds?: string[];
        index?: number;
        position?: number;
        volume?: number;
        muted?: boolean;
        isShuffle?: boolean;
        repeat?: 'off' | 'all' | 'one';
    };
}

const PUSH_DEBOUNCE_MS = 1500;

export function useUserStateSync() {
    const { status } = useAuth();
    const versionRef = useRef<number>(0);
    const hydratedRef = useRef<boolean>(false);
    const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (status !== 'authenticated') {
            hydratedRef.current = false;
            versionRef.current = 0;
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const r = await getUserState();
                if (cancelled) return;
                versionRef.current = r.version ?? 0;

                const s = (r.state ?? {}) as SyncedState;

                // Theme
                if (s.theme === 'light' || s.theme === 'dark') {
                    applyTheme(s.theme);
                }

                // UI store
                if (s.ui) {
                    const ui = useUIStore.getState();
                    if (typeof s.ui.leftWidth === 'number') ui.setLeftWidth(s.ui.leftWidth);
                    if (typeof s.ui.rightWidth === 'number') ui.setRightWidth(s.ui.rightWidth);
                    if (typeof s.ui.isLeftOpen === 'boolean') ui.setLeftOpen(s.ui.isLeftOpen);
                    if (typeof s.ui.isRightOpen === 'boolean') ui.setRightOpen(s.ui.isRightOpen);
                    if (s.ui.rightTab) ui.setRightTab(s.ui.rightTab);
                }

                // Позиция, без очереди
                if (s.player) {
                    const cur = usePlayer.getState();
                    usePlayer.setState({
                        volume: typeof s.player.volume === 'number' ? s.player.volume : cur.volume,
                        muted: typeof s.player.muted === 'boolean' ? s.player.muted : cur.muted,
                        isShuffle: typeof s.player.isShuffle === 'boolean' ? s.player.isShuffle : cur.isShuffle,
                        repeat: s.player.repeat ?? cur.repeat,
                    });
                }

                hydratedRef.current = true;
            } catch {
                hydratedRef.current = true;
            }
        })();

        return () => { cancelled = true; };
    }, [status]);

    useEffect(() => {
        if (status !== 'authenticated') return;

        const schedulePush = () => {
            if (!hydratedRef.current) return;
            if (pushTimer.current) clearTimeout(pushTimer.current);
            pushTimer.current = setTimeout(async () => {
                pushTimer.current = null;
                const ui = useUIStore.getState();
                const pl = usePlayer.getState();

                let theme: Theme | undefined;
                try {
                    const t = localStorage.getItem('copiuma.theme');
                    if (t === 'light' || t === 'dark') theme = t;
                } catch { /* ignore */ }

                const cur = pl.queue[pl.index];
                const snapshot: SyncedState = {
                    theme,
                    ui: {
                        leftWidth: ui.leftWidth,
                        rightWidth: ui.rightWidth,
                        isLeftOpen: ui.isLeftOpen,
                        isRightOpen: ui.isRightOpen,
                        rightTab: ui.rightTab,
                    },
                    player: {
                        queueIds: pl.queue.map(t => t.id),
                        index: pl.index,
                        position: pl.position,
                        volume: pl.volume,
                        muted: pl.muted,
                        isShuffle: pl.isShuffle,
                        repeat: pl.repeat,
                    },
                };

                try {
                    const res = await putUserState(snapshot as any, versionRef.current);
                    versionRef.current = res.version;
                } catch (e: any) {
                    // 409 — на сервере более свежая версия
                    if (e?.response?.status === 409) {
                        try {
                            const r = await getUserState();
                            versionRef.current = r.version ?? 0;
                        } catch { /* ignore */ }
                    }
                    // 401 позже трай
                    if (cur) void cur;
                }
            }, PUSH_DEBOUNCE_MS);
        };

        const unsubUi = useUIStore.subscribe(schedulePush);
        const unsubPlayer = usePlayer.subscribe(schedulePush);

        // Theme — слушаем localStorage events
        const onThemeStorage = (e: StorageEvent) => {
            if (e.key === 'copiuma.theme') schedulePush();
        };
        window.addEventListener('storage', onThemeStorage);

        // пушим каждые 30 сек
        const periodic = window.setInterval(schedulePush, 30_000);

        return () => {
            unsubUi();
            unsubPlayer();
            window.removeEventListener('storage', onThemeStorage);
            window.clearInterval(periodic);
            if (pushTimer.current) {
                clearTimeout(pushTimer.current);
                pushTimer.current = null;
            }
        };
    }, [status]);
}