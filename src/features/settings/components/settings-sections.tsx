import { useState } from "react";
import {
  Cpu,
  HardDrives,
  Palette,
  Shield,
  Sliders,
  FolderOpen,
} from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "../stores/settings-store";
import { moveModelsDirectory } from "../api/settings-api";
import { useToastStore } from "@/components/ui/toast";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  displayValue: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
      <span className="w-16 text-right text-sm font-medium text-foreground">
        {displayValue}
      </span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-border",
      )}
    >
      <div
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function HardwareSection() {
  const settings = useSettingsStore((s) => s.settings);
  const systemInfo = useSettingsStore((s) => s.systemInfo);
  const updateHardware = useSettingsStore((s) => s.updateHardware);
  const setAllowAllResources = useSettingsStore((s) => s.setAllowAllResources);

  if (!settings) return null;

  const { hardware } = settings;
  const maxCores = systemInfo?.cpu_cores ?? 16;
  const maxRamGb = systemInfo ? Math.round(systemInfo.total_ram_mb / 1024) : 64;

  const isAllResources =
    hardware.threads === 0 &&
    hardware.gpu_layers === -1 &&
    hardware.ram_limit_gb === null;

  return (
    <SectionCard title="Hardware" icon={Cpu}>
      <SettingRow
        label="Allow All Resources"
        description="Use all available CPU, GPU, and RAM"
      >
        <Toggle
          checked={isAllResources}
          onChange={(v) => {
            if (v) {
              setAllowAllResources();
            } else {
              updateHardware({ threads: Math.max(1, Math.floor(maxCores / 2)) });
            }
          }}
        />
      </SettingRow>

      <SettingRow
        label="CPU Threads"
        description={`${maxCores} cores available`}
      >
        <Slider
          value={hardware.threads}
          min={0}
          max={maxCores}
          step={1}
          onChange={(v) => updateHardware({ threads: v })}
          displayValue={hardware.threads === 0 ? "Auto" : `${hardware.threads}`}
        />
      </SettingRow>

      <SettingRow
        label="RAM Limit"
        description={`${maxRamGb} GB total`}
      >
        <Slider
          value={hardware.ram_limit_gb ?? maxRamGb}
          min={1}
          max={maxRamGb}
          step={1}
          onChange={(v) =>
            updateHardware({ ram_limit_gb: v >= maxRamGb ? null : v })
          }
          displayValue={
            hardware.ram_limit_gb === null
              ? "No limit"
              : `${hardware.ram_limit_gb} GB`
          }
        />
      </SettingRow>

      <SettingRow
        label="GPU Layers"
        description="Layers to offload to GPU (-1 = auto)"
      >
        <Slider
          value={hardware.gpu_layers}
          min={-1}
          max={100}
          step={1}
          onChange={(v) => updateHardware({ gpu_layers: v })}
          displayValue={
            hardware.gpu_layers === -1
              ? "Auto"
              : hardware.gpu_layers === 0
                ? "CPU only"
                : `${hardware.gpu_layers}`
          }
        />
      </SettingRow>

      <SettingRow
        label="Flash Attention"
        description="Faster inference with compatible models"
      >
        <Toggle
          checked={hardware.flash_attention}
          onChange={(v) => updateHardware({ flash_attention: v })}
        />
      </SettingRow>
    </SectionCard>
  );
}

export function InferenceSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateInference = useSettingsStore((s) => s.updateInference);

  if (!settings) return null;

  const { inference } = settings;

  return (
    <SectionCard title="Inference" icon={Sliders}>
      <SettingRow label="Temperature" description="Randomness of responses">
        <Slider
          value={inference.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) =>
            updateInference({ temperature: Math.round(v * 10) / 10 })
          }
          displayValue={inference.temperature.toFixed(1)}
        />
      </SettingRow>

      <SettingRow label="Top P" description="Nucleus sampling threshold">
        <Slider
          value={inference.top_p}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) =>
            updateInference({ top_p: Math.round(v * 100) / 100 })
          }
          displayValue={inference.top_p.toFixed(2)}
        />
      </SettingRow>

      <SettingRow label="Max Tokens" description="Maximum response length">
        <Slider
          value={inference.max_tokens}
          min={128}
          max={8192}
          step={128}
          onChange={(v) => updateInference({ max_tokens: v })}
          displayValue={`${inference.max_tokens}`}
        />
      </SettingRow>

      <SettingRow label="Context Size" description="Conversation memory window">
        <Slider
          value={inference.context_size}
          min={512}
          max={32768}
          step={512}
          onChange={(v) => updateInference({ context_size: v })}
          displayValue={`${inference.context_size}`}
        />
      </SettingRow>

      <div className="py-3">
        <p className="text-sm font-medium text-foreground">System Prompt</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Instructions prepended to every conversation
        </p>
        <textarea
          value={inference.system_prompt}
          onChange={(e) => updateInference({ system_prompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>
    </SectionCard>
  );
}

export function StorageSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateStorage = useSettingsStore((s) => s.updateStorage);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const addToast = useToastStore((s) => s.addToast);
  const [isMoving, setIsMoving] = useState(false);

  if (!settings) return null;

  const { storage } = settings;

  const handleChangeDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Models Directory",
      });

      if (selected && typeof selected === "string") {
        const oldDir = storage.models_directory;
        if (selected === oldDir) return;

        setIsMoving(true);
        try {
          await moveModelsDirectory(oldDir, selected);
          updateStorage({ models_directory: selected });
          await saveSettings();
          addToast("Models directory changed", "success");
        } catch (error) {
          addToast(`Failed to move models: ${error}`, "error");
        } finally {
          setIsMoving(false);
        }
      }
    } catch (error) {
      console.error("Directory picker error:", error);
    }
  };

  return (
    <SectionCard title="Storage" icon={HardDrives}>
      <div className="py-3">
        <p className="text-sm font-medium text-foreground">Models Directory</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {storage.models_directory}
        </p>
        <button
          type="button"
          onClick={handleChangeDirectory}
          disabled={isMoving}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          <FolderOpen size={14} />
          {isMoving ? "Moving files..." : "Change Directory"}
        </button>
      </div>

      <SettingRow
        label="Max Storage Size"
        description="Limit total space for models"
      >
        <Slider
          value={storage.max_storage_gb ?? 500}
          min={1}
          max={500}
          step={1}
          onChange={(v) =>
            updateStorage({ max_storage_gb: v >= 500 ? null : v })
          }
          displayValue={
            storage.max_storage_gb === null
              ? "No limit"
              : `${storage.max_storage_gb} GB`
          }
        />
      </SettingRow>
    </SectionCard>
  );
}

export function AppearanceSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  if (!settings) return null;

  const { appearance } = settings;
  const themes = ["light", "dark", "system"] as const;

  return (
    <SectionCard title="Appearance" icon={Palette}>
      <SettingRow label="Theme" description="Choose the app color scheme">
        <div className="flex gap-1">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => updateAppearance({ theme: t })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                appearance.theme === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Font Size" description="Base text size">
        <Slider
          value={appearance.font_size}
          min={12}
          max={20}
          step={1}
          onChange={(v) => updateAppearance({ font_size: v })}
          displayValue={`${appearance.font_size}px`}
        />
      </SettingRow>
    </SectionCard>
  );
}

export function PrivacySection() {
  const settings = useSettingsStore((s) => s.settings);
  const updatePrivacy = useSettingsStore((s) => s.updatePrivacy);

  if (!settings) return null;

  return (
    <SectionCard title="Privacy" icon={Shield}>
      <SettingRow
        label="Save Chat History"
        description="Store conversations locally for future reference"
      >
        <Toggle
          checked={settings.privacy.save_chat_history}
          onChange={(v) => updatePrivacy({ save_chat_history: v })}
        />
      </SettingRow>
    </SectionCard>
  );
}
