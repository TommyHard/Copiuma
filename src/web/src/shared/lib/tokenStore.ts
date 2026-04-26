/**
 * Хранение JWT и refresh-токена
 */

const ACCESS_KEY = 'copiuma.access';
const REFRESH_KEY = 'copiuma.refresh';

export const tokenStore = {
    getAccess(): string | null {
        return localStorage.getItem(ACCESS_KEY);
    },

    getRefresh(): string | null {
        return localStorage.getItem(REFRESH_KEY);
    },

    set(access: string, refresh: string) {
        localStorage.setItem(ACCESS_KEY, access);
        localStorage.setItem(REFRESH_KEY, refresh);
    },

    clear() {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    },
};