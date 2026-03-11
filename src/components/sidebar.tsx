import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChatCircle, MagnifyingGlass, HardDrives, GearSix, Plus, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { IS_AERO } from "@/lib/variant";
import { useModelStore } from "@/features/models/stores/model-store";
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useModeStore } from "@/stores/mode-store";

const navItems = [
  { to: "/chat", icon: ChatCircle, label: "Chat" },
  { to: "/library", icon: MagnifyingGlass, label: "Library" },
  { to: "/models", icon: HardDrives, label: "Models" },
  { to: "/settings", icon: GearSix, label: "Settings" },
] as const;

export function Sidebar() {
  const serverStatus = useModelStore((s) => s.serverStatus);
  const location = useLocation();
  const isOnChat = location.pathname === "/chat";

  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const loadConversation = useChatStore((s) => s.loadConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const deleteAllConversations = useChatStore((s) => s.deleteAllConversations);

  const activeMode = useModeStore((s) => s.activeMode);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Filter conversations by active mode
  const filteredConversations = useMemo(
    () => conversations.filter((c) => c.mode === activeMode),
    [conversations, activeMode],
  );

  const statusColor =
    serverStatus === "ready"
      ? "bg-success"
      : serverStatus === "starting"
        ? "bg-warning"
        : serverStatus === "error"
          ? "bg-destructive"
          : "bg-muted-foreground";

  return (
    <aside className={cn(
      "group flex h-full w-16 flex-col justify-between bg-muted transition-all duration-200 hover:w-56",
      IS_AERO && "glass-panel",
    )}>
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex shrink-0 flex-col gap-1 p-2 pt-4">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground",
                )
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className="overflow-hidden whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {isOnChat && (
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex shrink-0 items-center justify-between px-1 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                History
              </span>
              {filteredConversations.length > 0 && (
                <button
                  onClick={() => {
                    if (confirmDeleteAll) {
                      deleteAllConversations();
                      setConfirmDeleteAll(false);
                    } else {
                      setConfirmDeleteAll(true);
                      setTimeout(() => setConfirmDeleteAll(false), 3000);
                    }
                  }}
                  className={cn(
                    "rounded p-0.5 transition-colors",
                    confirmDeleteAll
                      ? "text-destructive"
                      : "text-muted-foreground hover:text-destructive",
                  )}
                  title={confirmDeleteAll ? "Click again to confirm" : "Delete all conversations"}
                >
                  <Trash size={12} />
                </button>
              )}
            </div>

            <button
              onClick={() => createConversation()}
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus size={14} className="shrink-0" />
              <span className="truncate">New Chat</span>
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={cn(
                    "group/item flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors",
                    conv.id === activeConversationId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <span className="truncate">{conv.title}</span>
                  <Trash
                    size={12}
                    className="shrink-0 opacity-0 transition-opacity hover:text-destructive group-hover/item:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 p-2 px-3 pb-4">
        <div className="flex shrink-0 items-center justify-center w-5">
          <div className={cn("h-2.5 w-2.5 rounded-full", statusColor)} />
        </div>
        <span className="overflow-hidden whitespace-nowrap text-xs text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Server: {serverStatus}
        </span>
      </div>
    </aside>
  );
}
