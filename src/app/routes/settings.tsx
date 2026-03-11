import { useEffect } from "react";
import { GearSix, FloppyDisk, ArrowCounterClockwise, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import {
  HardwareSection,
  InferenceSection,
  StorageSection,
  AppearanceSection,
  PrivacySection,
} from "@/features/settings/components/settings-sections";

export function SettingsRoute() {
  const settings = useSettingsStore((s) => s.settings);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const isDirty = useSettingsStore((s) => s.isDirty);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadSystemInfo = useSettingsStore((s) => s.loadSystemInfo);
  const saveSettings = useSettingsStore((s) => s.saveSettings);

  useEffect(() => {
    loadSettings();
    loadSystemInfo();
  }, [loadSettings, loadSystemInfo]);

  if (isLoading || !settings) {
    return (
      <div className="flex h-full items-center justify-center">
        <CircleNotch size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GearSixsize={24} className="text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Settings
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure hardware, inference, and appearance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadSettings}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ArrowCounterClockwisesize={14} />
              Reset
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={!isDirty}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors",
                isDirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
            >
              <FloppyDisksize={14} />
              Save
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <HardwareSection />
        <InferenceSection />
        <StorageSection />
        <AppearanceSection />
        <PrivacySection />
      </div>
    </div>
  );
}
