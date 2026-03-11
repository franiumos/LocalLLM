import { useState, useEffect, useMemo, useCallback } from "react";
import type { ComponentType } from "react";
import {
  ChatCircle,
  Code,
  Calculator,
  Image,
  Globe,
  CircleNotch,
  X,
  Cpu,
  Monitor,
  Stack,
  Warning,
  DownloadSimple,
  Check,
  Sparkle,
  CaretRight,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  getCatalogModels,
  getDownloadUrl,
} from "@/features/library/api/catalog-api";
import {
  useSettingsStore,
  type SystemInfo,
} from "@/features/settings/stores/settings-store";
import { useDownloadStore } from "@/features/models/stores/download-store";
import { useModelStore } from "@/features/models/stores/model-store";
import { useToastStore } from "@/components/ui/toast";
import type {
  CatalogModel,
  CatalogModelFile,
} from "@/features/models/types/model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UseCase = "chatting" | "coding" | "math" | "images" | "languages";
type WizardStep = 1 | 2 | 3;
type LoadMode = "ram_only" | "vram_only" | "both" | "not_enough";

interface UseCaseOption {
  id: UseCase;
  label: string;
  icon: ComponentType<IconProps>;
  description: string;
}

interface LoadRecommendation {
  mode: LoadMode;
  gpu_layers: number;
  label: string;
}

interface ScoredModel {
  model: CatalogModel;
  totalScore: number;
  useCaseScore: number;
  hardwareScore: number;
  matchedUseCases: string[];
  recommendedFile: CatalogModelFile;
  loadRecommendation: LoadRecommendation;
  totalSizeGb: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USE_CASE_OPTIONS: UseCaseOption[] = [
  {
    id: "chatting",
    label: "Chatting",
    icon: ChatCircle,
    description: "General conversation & Q&A",
  },
  {
    id: "coding",
    label: "Coding",
    icon: Code,
    description: "Code generation & debugging",
  },
  {
    id: "math",
    label: "Math & Reasoning",
    icon: Calculator,
    description: "Logic, math & problem solving",
  },
  {
    id: "images",
    label: "Generating Images",
    icon: Image,
    description: "Text-to-image generation",
  },
  {
    id: "languages",
    label: "Multiple Languages",
    icon: Globe,
    description: "Non-English conversations",
  },
];

const USE_CASE_CATEGORY_MAP: Record<UseCase, string> = {
  chatting: "chat",
  coding: "code",
  math: "reasoning",
  images: "image_generation",
  languages: "multilingual",
};

const CATEGORY_COLORS: Record<string, string> = {
  chat: "bg-blue-500/15 text-blue-400",
  code: "bg-emerald-500/15 text-emerald-400",
  reasoning: "bg-purple-500/15 text-purple-400",
  lightweight: "bg-amber-500/15 text-amber-400",
  multilingual: "bg-cyan-500/15 text-cyan-400",
  vision: "bg-pink-500/15 text-pink-400",
  image_generation: "bg-rose-500/15 text-rose-400",
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function computeLoadRecommendation(
  modelSizeGb: number,
  totalVramGb: number,
  availableRamGb: number,
  hasGpu: boolean,
): LoadRecommendation {
  const totalAvailable = availableRamGb + totalVramGb;

  if (modelSizeGb > totalAvailable) {
    return { mode: "not_enough", gpu_layers: 0, label: "Not enough memory" };
  }
  if (!hasGpu || totalVramGb === 0) {
    return { mode: "ram_only", gpu_layers: 0, label: "RAM only" };
  }
  if (totalVramGb >= modelSizeGb) {
    return { mode: "vram_only", gpu_layers: -1, label: "VRAM only" };
  }

  const gpuLayers = Math.max(
    1,
    Math.min(99, Math.round((totalVramGb / modelSizeGb) * 99)),
  );
  return {
    mode: "both",
    gpu_layers: gpuLayers,
    label: `Both (${gpuLayers} GPU layers)`,
  };
}

function scoreModels(
  catalog: CatalogModel[],
  selectedUseCases: UseCase[],
  systemInfo: SystemInfo,
): ScoredModel[] {
  const availableRamGb = systemInfo.available_ram_mb / 1024;
  const totalVramGb = systemInfo.gpus.reduce(
    (sum, g) => sum + g.vram_mb / 1024,
    0,
  );
  const totalAvailableGb = availableRamGb + totalVramGb;
  const hasGpu = systemInfo.gpus.length > 0;

  const results: ScoredModel[] = [];

  for (const model of catalog) {
    const recommendedFile =
      model.files.find((f) => f.quant === model.recommended_quant) ??
      model.files[0];
    const componentsSizeGb = (model.components ?? []).reduce(
      (sum, c) => sum + c.size_gb,
      0,
    );
    const totalSizeGb = recommendedFile.size_gb + componentsSizeGb;

    // --- Use-case score (0-5) ---
    let useCaseScore = 0;
    const matchedUseCases: string[] = [];

    for (const uc of selectedUseCases) {
      if (model.category === USE_CASE_CATEGORY_MAP[uc]) {
        useCaseScore = 5;
        matchedUseCases.push(uc);
      }
    }

    if (model.category === "lightweight") {
      useCaseScore = Math.max(useCaseScore, 2);
    }
    if (model.category === "vision" && selectedUseCases.includes("chatting")) {
      useCaseScore = Math.max(useCaseScore, 2);
      if (!matchedUseCases.includes("chatting")) matchedUseCases.push("chatting");
    }
    if (model.category === "code" && selectedUseCases.includes("math")) {
      useCaseScore = Math.max(useCaseScore, 1);
      if (!matchedUseCases.includes("math")) matchedUseCases.push("math");
    }

    // --- Hardware score (0-5) ---
    let hardwareScore: number;
    if (totalSizeGb > totalAvailableGb) {
      hardwareScore = 0;
    } else {
      const fillRatio = totalSizeGb / totalAvailableGb;
      if (fillRatio < 0.1) hardwareScore = 3;
      else if (fillRatio < 0.5) hardwareScore = 5;
      else if (fillRatio <= 0.9) hardwareScore = 4;
      else hardwareScore = 2;
    }

    const loadRecommendation = computeLoadRecommendation(
      totalSizeGb,
      totalVramGb,
      availableRamGb,
      hasGpu,
    );

    results.push({
      model,
      totalScore: useCaseScore + hardwareScore,
      useCaseScore,
      hardwareScore,
      matchedUseCases,
      recommendedFile,
      loadRecommendation,
      totalSizeGb,
    });
  }

  results.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.model.name.localeCompare(b.model.name);
  });

  return results;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepUseCases({
  selectedUseCases,
  toggleUseCase,
}: {
  selectedUseCases: UseCase[];
  toggleUseCase: (uc: UseCase) => void;
}) {
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        What do you plan to use AI for? Select one or more.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {USE_CASE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedUseCases.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleUseCase(option.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 text-center transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-muted text-muted-foreground hover:border-primary/30 hover:bg-accent",
              )}
            >
              <Icon
                size={28}
                className={isSelected ? "text-primary" : ""}
              />
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepScanning({
  isScanning,
  systemInfo,
}: {
  isScanning: boolean;
  systemInfo: SystemInfo | null;
}) {
  if (isScanning || !systemInfo) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <CircleNotch size={40} className="animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Scanning your hardware...
        </p>
      </div>
    );
  }

  const gpu = systemInfo.gpus[0];
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Check size={40} className="text-success" />
      <p className="text-sm font-medium text-foreground">Hardware detected</p>
      <div className="w-full space-y-2 rounded-xl border border-border bg-muted p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">CPU Cores</span>
          <span className="font-medium text-foreground">
            {systemInfo.cpu_cores}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">RAM</span>
          <span className="font-medium text-foreground">
            {(systemInfo.available_ram_mb / 1024).toFixed(1)} GB available /{" "}
            {(systemInfo.total_ram_mb / 1024).toFixed(1)} GB total
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">GPU</span>
          <span className="font-medium text-foreground">
            {gpu
              ? `${gpu.name} (${(gpu.vram_mb / 1024).toFixed(1)} GB VRAM)`
              : "No GPU detected"}
          </span>
        </div>
      </div>
    </div>
  );
}

function StepResults({
  scoredModels,
  downloadedFilenames,
  onDownload,
}: {
  scoredModels: ScoredModel[];
  downloadedFilenames: Set<string>;
  onDownload: (model: CatalogModel, file: CatalogModelFile) => void;
}) {
  const downloads = useDownloadStore((s) => s.downloads);

  const activeDownloads = useMemo(() => {
    const map = new Map<string, (typeof downloads)[string]>();
    for (const dl of Object.values(downloads)) {
      if (dl.status !== "complete" && dl.status !== "failed") {
        map.set(dl.filename, dl);
      }
    }
    return map;
  }, [downloads]);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Models ranked by compatibility with your hardware and use cases.
      </p>
      <div className="space-y-3">
        {scoredModels.map((scored) => {
          const {
            model,
            totalScore,
            recommendedFile,
            loadRecommendation,
            matchedUseCases,
            totalSizeGb,
          } = scored;
          const isDownloaded = downloadedFilenames.has(
            recommendedFile.filename,
          );
          const activeDl = activeDownloads.get(recommendedFile.filename);
          const progressPct =
            activeDl && activeDl.total_bytes > 0
              ? Math.round(
                  (activeDl.bytes_downloaded / activeDl.total_bytes) * 100,
                )
              : 0;

          const scoreColor =
            totalScore >= 8
              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              : totalScore >= 5
                ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30";

          const categoryColors =
            CATEGORY_COLORS[model.category] ??
            "bg-accent text-accent-foreground";

          const LoadIcon =
            loadRecommendation.mode === "vram_only"
              ? Monitor
              : loadRecommendation.mode === "ram_only"
                ? Cpu
                : loadRecommendation.mode === "both"
                  ? Stack
                  : Warning;

          return (
            <div
              key={model.id}
              className="rounded-xl border border-border bg-muted p-4"
            >
              <div className="flex items-start gap-3">
                {/* Score badge */}
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm font-bold",
                    scoreColor,
                  )}
                >
                  <span className="text-lg leading-none">{totalScore}</span>
                  <span className="text-[9px] font-normal opacity-70">
                    /10
                  </span>
                </div>

                {/* Model info */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {model.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {model.author}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {model.performance_score != null && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                          model.performance_score >= 8
                            ? "bg-emerald-500/15 text-emerald-400"
                            : model.performance_score >= 5
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-red-500/15 text-red-400",
                        )}
                      >
                        Quality {model.performance_score}/10
                      </span>
                    )}
                    <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                      {model.parameters}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        categoryColors,
                      )}
                    >
                      {model.category === "image_generation"
                        ? "Image Gen"
                        : model.category}
                    </span>
                  </div>

                  {matchedUseCases.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Best for:{" "}
                      {matchedUseCases
                        .map(
                          (uc) =>
                            USE_CASE_OPTIONS.find((o) => o.id === uc)?.label ??
                            uc,
                        )
                        .join(", ")}
                    </p>
                  )}

                  {/* Load recommendation */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <LoadIcon
                      size={12}
                      className={cn(
                        loadRecommendation.mode === "not_enough"
                          ? "text-destructive"
                          : "text-primary",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        loadRecommendation.mode === "not_enough"
                          ? "text-destructive"
                          : "text-foreground",
                      )}
                    >
                      {loadRecommendation.label}
                    </span>
                  </div>

                  {/* File info + download */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {recommendedFile.quant} &mdash; {totalSizeGb.toFixed(1)}{" "}
                      GB
                      {(model.components?.length ?? 0) > 0 &&
                        " (incl. components)"}
                    </span>
                    <div>
                      {isDownloaded ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                          <Check size={12} /> Downloaded
                        </span>
                      ) : loadRecommendation.mode === "not_enough" ? (
                        <span className="text-[11px] text-destructive">
                          Cannot run
                        </span>
                      ) : activeDl ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CircleNotch size={12} className="animate-spin" />
                          {progressPct}%
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDownload(model, recommendedFile)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <DownloadSimple size={12} />
                          Download
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ModelAdvisorProps {
  open: boolean;
  onClose: () => void;
}

export function ModelAdvisor({ open, onClose }: ModelAdvisorProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedUseCases, setSelectedUseCases] = useState<UseCase[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const systemInfo = useSettingsStore((s) => s.systemInfo);
  const loadSystemInfo = useSettingsStore((s) => s.loadSystemInfo);
  const localModels = useModelStore((s) => s.localModels);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const addToast = useToastStore((s) => s.addToast);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedUseCases([]);
      setIsScanning(false);
    }
  }, [open]);

  const downloadedFilenames = useMemo(
    () => new Set(localModels.map((m) => m.filename)),
    [localModels],
  );

  const scoredModels = useMemo(() => {
    if (!systemInfo || selectedUseCases.length === 0) return [];
    return scoreModels(getCatalogModels(), selectedUseCases, systemInfo);
  }, [systemInfo, selectedUseCases]);

  const toggleUseCase = (uc: UseCase) => {
    setSelectedUseCases((prev) =>
      prev.includes(uc) ? prev.filter((u) => u !== uc) : [...prev, uc],
    );
  };

  const handleNext = useCallback(async () => {
    if (step === 1) {
      setStep(2);
      setIsScanning(true);
      await loadSystemInfo();
      setIsScanning(false);
      setTimeout(() => setStep(3), 800);
    }
  }, [step, loadSystemInfo]);

  const handleDownload = useCallback(
    async (model: CatalogModel, file: CatalogModelFile) => {
      const url = getDownloadUrl(model.repo, file.filename);
      try {
        await startDownload(url, file.filename);
        addToast(`Download started: ${file.filename}`, "info");

        if (model.components && model.components.length > 0) {
          for (const comp of model.components) {
            const compUrl = getDownloadUrl(comp.repo, comp.filename);
            const localName = comp.filename.split("/").pop()!;
            if (!downloadedFilenames.has(localName)) {
              try {
                await startDownload(compUrl, localName);
              } catch (err) {
                console.error(
                  `Failed to download component ${localName}:`,
                  err,
                );
              }
            }
          }
          addToast(
            `Also downloading ${model.components.length} required component(s)`,
            "info",
          );
        }
      } catch {
        addToast(`Failed to start download: ${file.filename}`, "error");
      }
    },
    [startDownload, addToast, downloadedFilenames],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkle size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">
              Model Advisor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex shrink-0 items-center justify-center gap-2 py-3">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                step === s
                  ? "bg-primary"
                  : step > s
                    ? "bg-primary/40"
                    : "bg-border",
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {step === 1 && (
            <StepUseCases
              selectedUseCases={selectedUseCases}
              toggleUseCase={toggleUseCase}
            />
          )}
          {step === 2 && (
            <StepScanning isScanning={isScanning} systemInfo={systemInfo} />
          )}
          {step === 3 && (
            <StepResults
              scoredModels={scoredModels}
              downloadedFilenames={downloadedFilenames}
              onDownload={handleDownload}
            />
          )}
        </div>

        {/* Footer */}
        {step === 1 && (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={handleNext}
              disabled={selectedUseCases.length === 0}
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                selectedUseCases.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              Next
              <CaretRight size={16} className="ml-1 inline" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
