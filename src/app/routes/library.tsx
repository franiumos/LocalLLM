import { useState, useEffect, useMemo } from "react";
import type { ComponentType } from "react";
import {
  DownloadSimple,
  Check,
  CircleNotch,
  Package,
  MagnifyingGlass,
  ArrowSquareOut,
  Eye,
  Wrench,
  Image,
  Sparkle,
  X,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";
import { getCatalogModels, getDownloadUrl } from "@/features/library/api/catalog-api";
import { useDownloadStore } from "@/features/models/stores/download-store";
import { useModelStore } from "@/features/models/stores/model-store";
import { useToastStore } from "@/components/ui/toast";
import type { CatalogModel, CatalogModelFile } from "@/features/models/types/model";
import type { ModelCapability } from "@/lib/types";
import { ModelAdvisor } from "@/features/library/components/model-advisor";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "chat", label: "Chat" },
  { key: "code", label: "Code" },
  { key: "reasoning", label: "Reasoning" },
  { key: "lightweight", label: "Lightweight" },
  { key: "multilingual", label: "Multilingual" },
  { key: "vision", label: "Vision" },
  { key: "image_generation", label: "Image Gen" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  chat: "bg-blue-500/15 text-blue-400",
  code: "bg-emerald-500/15 text-emerald-400",
  reasoning: "bg-purple-500/15 text-purple-400",
  lightweight: "bg-amber-500/15 text-amber-400",
  multilingual: "bg-cyan-500/15 text-cyan-400",
  vision: "bg-pink-500/15 text-pink-400",
  image_generation: "bg-rose-500/15 text-rose-400",
};

const CAPABILITY_FILTERS: {
  key: ModelCapability;
  label: string;
  icon: ComponentType<IconProps>;
}[] = [
  { key: "vision", label: "Vision", icon: Eye },
  { key: "tool_use", label: "Tool Use", icon: Wrench },
  { key: "image_generation", label: "Image Gen", icon: Image },
];

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? "bg-accent text-accent-foreground";
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium capitalize", colors)}>
      {category === "image_generation" ? "Image Gen" : category}
    </span>
  );
}

function CapabilityBadges({ capabilities }: { capabilities?: string[] }) {
  if (!capabilities || capabilities.length === 0) return null;
  return (
    <>
      {capabilities.map((cap) => {
        const filter = CAPABILITY_FILTERS.find((f) => f.key === cap);
        if (!filter) return null;
        const Icon = filter.icon;
        return (
          <span
            key={cap}
            className="inline-flex items-center gap-0.5 rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <Icon size={10} />
            {filter.label}
          </span>
        );
      })}
    </>
  );
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const color =
    score >= 8
      ? "bg-emerald-500/15 text-emerald-400"
      : score >= 5
        ? "bg-amber-500/15 text-amber-400"
        : "bg-red-500/15 text-red-400";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold", color)}>
      {score}/10
    </span>
  );
}

function CatalogModelCard({ model }: { model: CatalogModel }) {
  const [expanded, setExpanded] = useState(false);
  const downloads = useDownloadStore((s) => s.downloads);
  const localModels = useModelStore((s) => s.localModels);
  const startDownload = useDownloadStore((s) => s.startDownload);
  const addToast = useToastStore((s) => s.addToast);

  const downloadedFilenames = useMemo(
    () => new Set(localModels.map((m) => m.filename)),
    [localModels],
  );

  const activeDownloadsByFilename = useMemo(() => {
    const map = new Map<string, (typeof downloads)[string]>();
    for (const dl of Object.values(downloads)) {
      if (dl.status !== "complete" && dl.status !== "failed") {
        map.set(dl.filename, dl);
      }
    }
    return map;
  }, [downloads]);

  const handleDownload = async (file: CatalogModelFile) => {
    const url = getDownloadUrl(model.repo, file.filename);
    try {
      await startDownload(url, file.filename);
      addToast(`Download started: ${file.filename}`, "info");

      // Auto-download component files (text encoders, VAE, etc.)
      if (model.components && model.components.length > 0) {
        for (const comp of model.components) {
          const compUrl = getDownloadUrl(comp.repo, comp.filename);
          const localName = comp.filename.split("/").pop()!;

          // Skip if already downloaded or already downloading
          if (
            downloadedFilenames.has(localName) ||
            activeDownloadsByFilename.has(localName)
          ) {
            console.log(`[library] Component already present: ${localName}`);
            continue;
          }

          try {
            await startDownload(compUrl, localName);
            console.log(`[library] Component download started: ${localName}`);
          } catch (err) {
            console.error(`Failed to download component ${localName}:`, err);
          }
        }
        addToast(
          `Also downloading ${model.components.length} required component(s)`,
          "info",
        );
      }
    } catch (error) {
      addToast(`Failed to start download: ${file.filename}`, "error");
      console.error("Download start failed:", error);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted p-5">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full cursor-pointer items-start justify-between text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{model.name}</h3>
            {model.homepage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openUrl(model.homepage!);
                }}
                className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary"
                title="View on HuggingFace"
              >
                <ArrowSquareOut size={14} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{model.author}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={model.performance_score} />
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {model.parameters}
            </span>
            <CategoryBadge category={model.category} />
            <CapabilityBadges capabilities={model.capabilities} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {model.description}
          </p>
        </div>
        <div className="ml-3 mt-1 shrink-0 text-muted-foreground">
          {expanded ? <CaretUp size={18} /> : <CaretDown size={18} />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Available Files
          </p>
          {model.components && model.components.length > 0 && (
            <div className="mb-3 rounded-lg border border-border/50 bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                Requires {model.components.length} additional component
                {model.components.length > 1 ? "s" : ""}
              </span>
              {" — "}
              {model.components
                .map((c) => `${c.filename.split("/").pop()} (${c.size_gb} GB)`)
                .join(", ")}
              {". "}
              <span className="text-muted-foreground/80">
                Total:{" "}
                {(
                  model.components.reduce((sum, c) => sum + c.size_gb, 0)
                ).toFixed(1)}{" "}
                GB extra. Auto-downloaded with the model.
              </span>
            </div>
          )}
          {model.files.map((file) => {
            const isDownloaded = downloadedFilenames.has(file.filename);
            const activeDl = activeDownloadsByFilename.get(file.filename);
            const isRecommended = file.quant === model.recommended_quant;
            const progressPct =
              activeDl && activeDl.total_bytes > 0
                ? Math.round(
                    (activeDl.bytes_downloaded / activeDl.total_bytes) * 100,
                  )
                : 0;

            return (
              <div
                key={file.filename}
                className="relative overflow-hidden rounded-lg border border-border bg-background p-3"
              >
                {activeDl && activeDl.total_bytes > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                )}
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {file.filename}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {file.size_gb} GB
                      </span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                        {file.quant}
                      </span>
                      {isRecommended && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                          Recommended
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isDownloaded ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-success/20 px-3 py-1.5 text-xs font-medium text-success">
                        <Check size={14} />
                        Downloaded
                      </span>
                    ) : activeDl ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CircleNotch size={14} className="animate-spin" />
                        {progressPct}%
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <DownloadSimple size={14} />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LibraryRoute() {
  const refreshLocalModels = useModelStore((s) => s.refreshLocalModels);
  const catalogModels = useMemo(() => getCatalogModels(), []);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeCapabilities, setActiveCapabilities] = useState<ModelCapability[]>([]);
  const [showAdvisor, setShowAdvisor] = useState(false);

  useEffect(() => {
    refreshLocalModels();
  }, [refreshLocalModels]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: catalogModels.length };
    for (const model of catalogModels) {
      counts[model.category] = (counts[model.category] ?? 0) + 1;
    }
    return counts;
  }, [catalogModels]);

  const toggleCapability = (cap: ModelCapability) => {
    setActiveCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  };

  const filteredModels = useMemo(() => {
    const q = search.toLowerCase().trim();
    return catalogModels.filter((model) => {
      if (activeCategory !== "all" && model.category !== activeCategory) return false;

      // Capability filter: model must have all selected capabilities
      if (activeCapabilities.length > 0) {
        const caps = model.capabilities ?? [];
        if (!activeCapabilities.every((c) => caps.includes(c))) return false;
      }

      if (q) {
        return (
          model.name.toLowerCase().includes(q) ||
          model.author.toLowerCase().includes(q) ||
          model.description.toLowerCase().includes(q) ||
          model.parameters.toLowerCase().includes(q) ||
          model.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [catalogModels, search, activeCategory, activeCapabilities]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Model Library</h1>
            <p className="text-sm text-muted-foreground">
              Browse and download open-source models
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvisor(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkle size={14} />
            Find My Model
          </button>
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-b border-border px-6 py-4">
        <div className="relative">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search models by name, author, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.key] ?? 0;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveCategory(cat.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {cat.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    isActive ? "bg-primary-foreground/20" : "bg-background",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Capability filter pills */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Capabilities
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CAPABILITY_FILTERS.map(({ key, label, icon: Icon }) => {
              const isActive = activeCapabilities.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCapability(key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon size={12} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filteredModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted py-16 text-muted-foreground">
            <MagnifyingGlass size={40} weight="light" />
            <p className="text-sm">No models found</p>
            <p className="text-xs">Try a different search or category filter</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredModels.map((model) => (
              <CatalogModelCard key={model.id} model={model} />
            ))}
          </div>
        )}
      </div>

      <ModelAdvisor open={showAdvisor} onClose={() => setShowAdvisor(false)} />
    </div>
  );
}
