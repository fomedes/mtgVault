import { create } from "zustand";
import { DEFAULT_BACKGROUND_ID } from "@/lib/backgrounds";

/**
 * Client-side UI preferences. The background id is seeded from the persisted
 * server value (by `BackgroundLayer` on mount) and updated optimistically by
 * the appearance picker, which also persists via `PATCH /api/me/preferences`.
 */
interface PreferencesState {
  backgroundId: string;
  setBackgroundId: (id: string) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  backgroundId: DEFAULT_BACKGROUND_ID,
  setBackgroundId: (id) => set({ backgroundId: id }),
}));
