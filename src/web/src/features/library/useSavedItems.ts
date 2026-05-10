import { useEffect, useState } from 'react';
import { listSavedItems, listSavedByKind, isSaved, subscribeSaved, type SavedItem, type SavedItemKind } from './savedItems';

export function useSavedItems(): SavedItem[] {
    const [items, setItems] = useState<SavedItem[]>(() => listSavedItems());
    useEffect(() => {
        return subscribeSaved(() => setItems(listSavedItems()));
    }, []);
    return items;
}

export function useSavedItemsByKind(kind: SavedItemKind): SavedItem[] {
    const [items, setItems] = useState<SavedItem[]>(() => listSavedByKind(kind));
    useEffect(() => {
        return subscribeSaved(() => setItems(listSavedByKind(kind)));
    }, [kind]);
    return items;
}

export function useIsSaved(kind: SavedItemKind, id: string | undefined | null): boolean {
    const [saved, setSaved] = useState<boolean>(() => !!id && isSaved(kind, id));
    useEffect(() => {
        if (!id) { setSaved(false); return; }
        const check = () => setSaved(isSaved(kind, id));
        check();
        return subscribeSaved(check);
    }, [kind, id]);
    return saved;
}