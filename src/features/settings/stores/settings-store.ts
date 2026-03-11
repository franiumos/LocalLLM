import { create } from "zustand";
import {
  getSettings,
  saveSettings as saveSettingsApi,
  getSystemInfo,
} from "../api/settings-api";
import { IS_AERO } from "@/lib/variant";

export interface InferenceSettings {
  temperature: number;
  top_p: number;
  context_size: number;
  max_tokens: number;
  system_prompt: string;
}

export interface HardwareSettings {
  gpu_layers: number;
  threads: number;
  flash_attention: boolean;
  ram_limit_gb: number | null;
}

export interface StorageSettings {
  models_directory: string;
  max_storage_gb: number | null;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  font_size: number;
}

export interface PrivacySettings {
  save_chat_history: boolean;
}

export interface AppSettings {
  inference: InferenceSettings;
  hardware: HardwareSettings;
  storage: StorageSettings;
  appearance: AppearanceSettings;
  privacy: PrivacySettings;
}

export interface GpuInfo {
  name: string;
  vendor: string;
  vram_mb: number;
  backend: string;
}

export interface SystemInfo {
  gpus: GpuInfo[];
  total_ram_mb: number;
  available_ram_mb: number;
  cpu_cores: number;
}

interface SettingsState {
  settings: AppSettings | null;
  systemInfo: SystemInfo | null;
  isLoading: boolean;
  isDirty: boolean;

  loadSettings: () => Promise<void>;
  loadSystemInfo: () => Promise<void>;
  updateInference: (partial: Partial<InferenceSettings>) => void;
  updateHardware: (partial: Partial<HardwareSettings>) => void;
  updateStorage: (partial: Partial<StorageSettings>) => void;
  updateAppearance: (partial: Partial<AppearanceSettings>) => void;
  updatePrivacy: (partial: Partial<PrivacySettings>) => void;
  saveSettings: () => Promise<void>;
  setAllowAllResources: () => void;
}

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  let resolved: "dark" | "light";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    resolved = theme;
  }
  if (IS_AERO) {
    root.setAttribute("data-theme", resolved === "dark" ? "aero" : "aero-light");
  } else {
    root.setAttribute("data-theme", resolved);
  }
}

function applyFontSize(size: number) {
  document.documentElement.style.fontSize = `${size}px`;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  systemInfo: null,
  isLoading: false,
  isDirty: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await getSettings();
      set({ settings, isLoading: false, isDirty: false });
      applyTheme(settings.appearance.theme);
      applyFontSize(settings.appearance.font_size);
    } catch (error) {
      console.error("Failed to load settings:", error);
      set({ isLoading: false });
    }
  },

  loadSystemInfo: async () => {
    try {
      const systemInfo = await getSystemInfo();
      set({ systemInfo });
    } catch (error) {
      console.error("Failed to load system info:", error);
    }
  },

  updateInference: (partial) => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        inference: { ...settings.inference, ...partial },
      },
      isDirty: true,
    });
  },

  updateHardware: (partial) => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        hardware: { ...settings.hardware, ...partial },
      },
      isDirty: true,
    });
  },

  updateStorage: (partial) => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        storage: { ...settings.storage, ...partial },
      },
      isDirty: true,
    });
  },

  updateAppearance: (partial) => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        appearance: { ...settings.appearance, ...partial },
      },
      isDirty: true,
    });
  },

  updatePrivacy: (partial) => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        privacy: { ...settings.privacy, ...partial },
      },
      isDirty: true,
    });
  },

  saveSettings: async () => {
    const { settings } = get();
    if (!settings) return;
    try {
      await saveSettingsApi(settings);
      set({ isDirty: false });
      applyTheme(settings.appearance.theme);
      applyFontSize(settings.appearance.font_size);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  },

  setAllowAllResources: () => {
    const { settings } = get();
    if (!settings) return;
    set({
      settings: {
        ...settings,
        hardware: {
          ...settings.hardware,
          threads: 0,
          gpu_layers: -1,
          ram_limit_gb: null,
        },
      },
      isDirty: true,
    });
  },
}));
