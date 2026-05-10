/**
 * Локально сохранённые элементы медиатеки: альбомы (артистов) и чужие плейлисты
 *
 * Хранятся в localStorage. Это позволяет пользователю сох.
 * любой объект в свою панель без бэкенд-таблицы для follows
 *
 * Если объект - 404, помечаем как unavailable
 */

const STORAGE_KEY = 'cw:saved-items';

export type SavedItemKind = 'album' | 'playlist';

export interface SavedItem {
    id: string;
    kind: SavedItemKind;
    title: string;
    subtitle?: string | null;       // имя артиста / автора плейлиста
    coverUrl?: string | null;
    addedAt: string;                // ISO
    unavailable?: boolean;          // true когда объект 404 / удалён
}

type SavedMap = Record<string, SavedItem>;

function readMap(): SavedMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

function writeMap(map: SavedMap): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
}

function key(kind: SavedItemKind, id: string): string {
    return `${kind}:${id}`;
}

/** Список всех сохранённых элементов, отсортированных по дате добавления (новые сверху) */
export function listSavedItems(): SavedItem[] {
    return Object.values(readMap())
        .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
}

export function listSavedByKind(kind: SavedItemKind): SavedItem[] {
    return listSavedItems().filter(i => i.kind === kind);
}

export function isSaved(kind: SavedItemKind, id: string): boolean {
    return !!readMap()[key(kind, id)];
}

export function saveItem(item: Omit<SavedItem, 'addedAt' | 'unavailable'>): void {
    const map = readMap();
    map[key(item.kind, item.id)] = {
        ...item,
        addedAt: new Date().toISOString(),
        unavailable: false,
    };
    writeMap(map);
    notify();
}

export function unsaveItem(kind: SavedItemKind, id: string): void {
    const map = readMap();
    delete map[key(kind, id)];
    writeMap(map);
    notify();
}

export function markUnavailable(kind: SavedItemKind, id: string, unavailable: boolean): void {
    const map = readMap();
    const k = key(kind, id);
    if (!map[k]) return;
    map[k] = { ...map[k], unavailable };
    writeMap(map);
    notify();
}

const listeners = new Set<() => void>();
function notify() {
    for (const l of listeners) l();
}
export function subscribeSaved(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}