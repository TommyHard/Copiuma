/**
 * «апоминание последней комнаты пользовател€ в localStorage,
 * чтобы после ухода со страницы можно было вернутьс€
 *
 * —охран€ем при заходе на /rooms/{id}, чистим при €вном "¬ыйти"
 * —ервер хранит состо€ние комнаты в Redis, поэтому возврат Ч просто
 * новый JoinRoom с тем же id.
 */

const KEY = 'cw:last-room';

export interface LastRoom {
    id: string;
    asDj: boolean;
    enteredAt: string;
}

export function rememberRoom(id: string, asDj: boolean): void {
    try {
        localStorage.setItem(
            KEY,
            JSON.stringify({ id, asDj, enteredAt: new Date().toISOString() } as LastRoom),
        );
    } catch {
        // ignore
    }
}

export function getLastRoom(): LastRoom | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const v = JSON.parse(raw) as Partial<LastRoom>;
        if (!v.id) return null;
        return { id: v.id, asDj: !!v.asDj, enteredAt: v.enteredAt ?? '' };
    } catch {
        return null;
    }
}

export function clearLastRoom(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // ignore
    }
}