import { getCurrentWindow } from "@tauri-apps/api/window";
import { Sparkle, Minus, Square, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { APP_TITLE, IS_AERO } from "@/lib/variant";

export function Titlebar() {
  const appWindow = getCurrentWindow();

  const handleDragStart = (e: React.MouseEvent) => {
    // Only drag on left-click, and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    e.preventDefault();
    appWindow.startDragging();
  };

  const btnBase =
    "inline-flex h-8 w-10 items-center justify-center text-muted-foreground transition-colors";
  const btnHover = IS_AERO
    ? "rounded-md hover:bg-white/10 hover:text-foreground"
    : "hover:bg-border hover:text-foreground";

  return (
    <div
      onMouseDown={handleDragStart}
      className={cn(
        "flex h-10 shrink-0 items-center justify-between bg-muted px-3 select-none",
        IS_AERO && "glass-panel glass-glossy",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground pointer-events-none">
        <Sparkle size={16} className="text-primary" />
        <span>{APP_TITLE}</span>
      </div>

      <div className="flex items-center">
        <button
          onClick={() => appWindow.minimize()}
          className={cn(btnBase, btnHover)}
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className={cn(btnBase, btnHover)}
          aria-label="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.close()}
          className={cn(
            btnBase,
            IS_AERO
              ? "rounded-md hover:bg-red-500/30 hover:text-white"
              : "hover:bg-destructive hover:text-white",
          )}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
