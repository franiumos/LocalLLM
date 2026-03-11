import { create } from "zustand";
import type { AppMode } from "@/lib/types";

interface ModeState {
  activeMode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useModeStore = create<ModeState>((set) => ({
  activeMode: "chat",
  setMode: (mode) => set({ activeMode: mode }),
}));
