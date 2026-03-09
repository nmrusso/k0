import { create } from "zustand";
import { getConfig, setConfig } from "@/lib/tauri-commands";
import type { ResourceType } from "@/types/k8s";

export interface FavoriteEntry {
  id: string;
  resourceType: ResourceType;
  name: string;
  namespace: string;
  context: string;
  label: string;
  pinnedAt: number;
}

const CONFIG_KEY = "favorites";

interface FavoritesState {
  favorites: FavoriteEntry[];
  loaded: boolean;
  loadFavorites: () => Promise<void>;
  addFavorite: (entry: Omit<FavoriteEntry, "id" | "pinnedAt">) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (resourceType: ResourceType, name: string, context: string) => boolean;
}

async function persist(favorites: FavoriteEntry[]) {
  await setConfig(CONFIG_KEY, JSON.stringify(favorites));
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  loaded: false,

  loadFavorites: async () => {
    try {
      const val = await getConfig(CONFIG_KEY);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          set({ favorites: parsed, loaded: true });
          return;
        }
      }
    } catch { /* ignore */ }
    set({ favorites: [], loaded: true });
  },

  addFavorite: async (entry) => {
    const fav: FavoriteEntry = {
      ...entry,
      id: crypto.randomUUID(),
      pinnedAt: Date.now(),
    };
    const updated = [...get().favorites, fav];
    set({ favorites: updated });
    await persist(updated);
  },

  removeFavorite: async (id) => {
    const updated = get().favorites.filter((f) => f.id !== id);
    set({ favorites: updated });
    await persist(updated);
  },

  isFavorite: (resourceType, name, context) => {
    return get().favorites.some(
      (f) => f.resourceType === resourceType && f.name === name && f.context === context,
    );
  },
}));
