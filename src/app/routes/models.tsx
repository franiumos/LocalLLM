import { useState, useEffect, useCallback } from "react";
import {
  HardDrivess,
  Pause,
  X,
  Trash,
  Play,
  CircleNotch,
  Check,
  DownloadSimple,
} from "@phosphor-icons/react";
import { cn, formatBytes } from "@/lib/utils";
import { useModelStore } from "@/features/models/stores/model-store";
import { useDownloadStore, type DownloadProgress } from "@/features/models/stores/download-store";
import { deleteModel, getStorageUsage } from "@/features/models/api/model-commands";
import { useToastStore } from "@/components/ui/toast";
import { isComponentFile, isImageGenerationModel } from "@/features/models/utils/capabilities";
import { LoadModeMenu } from "@/features/models/components/load-mode-menu";
import type { LocalModel } from "@/features/models/types/model";

function StorageBar({
  used,
  total,
}: {
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Storage</span>
        <span className="text-foreground">
          {formatBytes(used)} used of {formatBytes(total)} available
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct > 90 ? "bg-destructive" : pct > 70 ? "bg-warning" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatSpeed(bps: number): string {
  const mbps = bps / (1024 * 1024);
  return `${mbps.toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function ActiveDownloads() {
  const downloads = useDownloadStore((s) => s.downloads);
  const pauseDownload = useDownloadStore((s) => s.pauseDownload);
  const resumeDownload = useDownloadStore((s) => s.resumeDownload);
  const cancelDownload = useDownloadStore((s) => s.cancelDownload);

  const activeDownloads = Object.values(downloads).filter(
    (d) => d.status !== "complete",
  );

  if (activeDownloads.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <DownloadSimple size={16} />
        Active Downloads ({activeDownloads.length})
      </h2>
      {activeDownloads.map((dl) => (
        <DownloadCard
          key={dl.id}
          download={dl}
          onPause={pauseDownload}
          onResume={resumeDownload}
          onCancel={cancelDownload}
        />
      ))}
    </div>
  );
}

function DownloadCard({
  download,
  onPause,
  onResume,
  onCancel,
}: {
  download: DownloadProgress;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const pct =
    download.total_bytes > 0
      ? Math.round((download.bytes_downloaded / download.total_bytes) * 100)
      : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {download.filename}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {download.status === "downloading" && (
              <>
                <span>{formatSpeed(download.speed_bps)}</span>
                <span>ETA {formatEta(download.eta_seconds)}</span>
              </>
            )}
            {download.status === "queued" && <span>Queued...</span>}
            {download.status === "paused" && <span>Paused</span>}
            {download.status === "failed" && (
              <span className="text-destructive">Failed</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium text-foreground">{pct}%</span>
          {download.status === "paused" && (
            <button
              type="button"
              onClick={() => onResume(download.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              title="Resume"
            >
              <Play size={16} />
            </button>
          )}
          {(download.status === "downloading" ||
            download.status === "queued") && (
            <button
              type="button"
              onClick={() => onPause(download.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              title="Pause"
            >
              <Pause size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onCancel(download.id)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ModelRow({
  model,
  isActive,
  isLoading,
  isImageModel,
  onLoad,
  onDelete,
}: {
  model: LocalModel;
  isActive: boolean;
  isLoading: boolean;
  isImageModel: boolean;
  onLoad: (gpuLayers: number) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLoadMenu, setShowLoadMenu] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleLoadClick = () => {
    if (isImageModel) {
      onLoad(-1);
    } else {
      setShowLoadMenu(!showLoadMenu);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted">
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {model.filename}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formatBytes(model.size_bytes)}
            </span>
            {model.quantization && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                {model.quantization}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(model.downloaded_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-success/20 px-3 py-1.5 text-xs font-medium text-success">
              <Check size={14} />
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={handleLoadClick}
              disabled={isLoading}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <CircleNotch size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              Load
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isActive}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30",
              confirmDelete
                ? "bg-destructive text-white"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
            )}
            title={isActive ? "Unload model before deleting" : "Delete model"}
          >
            <Trash size={14} />
            {confirmDelete ? "Confirm" : "Delete"}
          </button>
        </div>
      </div>

      {showLoadMenu && (
        <div className="border-t border-border px-5 py-3">
          <LoadModeMenu
            onSelect={(gpuLayers) => {
              setShowLoadMenu(false);
              onLoad(gpuLayers);
            }}
            onClose={() => setShowLoadMenu(false)}
            inline
          />
        </div>
      )}
    </div>
  );
}

export function ModelsRoute() {
  const allLocalModels = useModelStore((s) => s.localModels);
  const localModels = allLocalModels.filter((m) => !isComponentFile(m.filename));
  const activeModel = useModelStore((s) => s.activeModel);
  const loadingModel = useModelStore((s) => s.loadingModel);
  const loadModel = useModelStore((s) => s.loadModel);
  const refreshLocalModels = useModelStore((s) => s.refreshLocalModels);
  const downloads = useDownloadStore((s) => s.downloads);
  const addToast = useToastStore((s) => s.addToast);

  const [storageUsed, setStorageUsed] = useState(0);
  const [storageTotal, setStorageTotal] = useState(0);

  const fetchStorage = useCallback(async () => {
    try {
      const [used, total] = await getStorageUsage();
      setStorageUsed(used);
      setStorageTotal(total);
    } catch (error) {
      console.error("Failed to fetch storage usage:", error);
    }
  }, []);

  useEffect(() => {
    refreshLocalModels();
    fetchStorage();
  }, [refreshLocalModels, fetchStorage]);

  const completedCount = Object.values(downloads).filter(
    (d) => d.status === "complete",
  ).length;
  useEffect(() => {
    if (completedCount > 0) {
      refreshLocalModels();
      fetchStorage();
    }
  }, [completedCount, refreshLocalModels, fetchStorage]);

  const handleLoadModel = async (model: LocalModel, gpuLayers: number) => {
    try {
      await loadModel(model.filepath, gpuLayers);
    } catch (error) {
      console.error("Failed to load model:", error);
    }
  };

  const handleDeleteModel = async (model: LocalModel) => {
    try {
      await deleteModel(model.filename);
      addToast(`Deleted: ${model.filename}`, "info");
      await refreshLocalModels();
      await fetchStorage();
    } catch (error) {
      addToast(`Failed to delete: ${model.filename}`, "error");
      console.error("Failed to delete model:", error);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <HardDrives size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Models</h1>
            <p className="text-sm text-muted-foreground">
              Manage your downloaded models
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <StorageBar used={storageUsed} total={storageTotal} />

        <ActiveDownloads />

        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Downloaded Models ({localModels.length})
          </h2>
          {localModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted py-12 text-muted-foreground">
              <HardDrives size={40} weight="light" />
              <p className="text-sm">No models downloaded yet</p>
              <p className="text-xs">
                Visit the Model Library to browse and download models
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {localModels.map((model) => (
                <ModelRow
                  key={model.id}
                  model={model}
                  isActive={activeModel === model.filepath}
                  isLoading={loadingModel === model.filepath}
                  isImageModel={isImageGenerationModel(model.filename)}
                  onLoad={(gpuLayers) => handleLoadModel(model, gpuLayers)}
                  onDelete={() => handleDeleteModel(model)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
