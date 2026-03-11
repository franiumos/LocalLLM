import { useState, useRef, useEffect } from "react";
import { CaretDown, CaretLeft, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useModelStore } from "@/features/models/stores/model-store";
import { useModeStore } from "@/stores/mode-store";
import { getModelsForMode, isImageGenerationModel } from "@/features/models/utils/capabilities";
import { LoadModeMenu } from "@/features/models/components/load-mode-menu";

export function ModelSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const activeModel = useModelStore((s) => s.activeModel);
  const serverStatus = useModelStore((s) => s.serverStatus);
  const localModels = useModelStore((s) => s.localModels);
  const loadModel = useModelStore((s) => s.loadModel);
  const unloadModel = useModelStore((s) => s.unloadModel);
  const activeMode = useModeStore((s) => s.activeMode);

  const filteredModels = getModelsForMode(localModels, activeMode);

  const activeFilename = activeModel
    ? activeModel.split(/[/\\]/).pop() ?? activeModel
    : null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPendingModel(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (filepath: string) => {
    if (filepath === activeModel) {
      setIsOpen(false);
      return;
    }

    const filename = filepath.split(/[/\\]/).pop() ?? "";
    if (isImageGenerationModel(filename)) {
      setIsOpen(false);
      if (activeModel) await unloadModel();
      await loadModel(filepath);
      return;
    }

    setPendingModel(filepath);
  };

  const handleLoadModeSelect = async (gpuLayers: number) => {
    if (!pendingModel) return;
    const filepath = pendingModel;
    setPendingModel(null);
    setIsOpen(false);
    if (activeModel) await unloadModel();
    await loadModel(filepath, gpuLayers);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setPendingModel(null);
        }}
        className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent"
      >
        {serverStatus === "starting" && (
          <CircleNotch size={12} className="animate-spin" />
        )}
        <span className="max-w-[200px] truncate">
          {activeFilename ?? "No model loaded"}
        </span>
        <CaretDown size={12} className="text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-background p-1 shadow-lg">
          {pendingModel ? (
            <>
              <div className="mb-1 flex items-center gap-2 border-b border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => setPendingModel(null)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <CaretLeft size={14} />
                </button>
                <span className="truncate text-xs font-medium text-foreground">
                  {pendingModel.split(/[/\\]/).pop()}
                </span>
              </div>
              <LoadModeMenu
                onSelect={handleLoadModeSelect}
                onClose={() => setPendingModel(null)}
                inline
              />
            </>
          ) : filteredModels.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No models downloaded for this mode
            </p>
          ) : (
            filteredModels.map((model) => {
              const isActive = model.filepath === activeModel;
              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model.filepath)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate">{model.filename}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                    {(model.size_bytes / 1073741824).toFixed(1)} GB
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
