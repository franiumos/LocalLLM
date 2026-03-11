import { ChatCircle, Plus, Warning } from "@phosphor-icons/react";
import { useChatStore } from "@/features/chat/stores/chat-store";
import { useModelStore } from "@/features/models/stores/model-store";
import { useModeStore } from "@/stores/mode-store";
import { MessageList } from "@/features/chat/components/message-list";
import { MessageInput } from "@/features/chat/components/message-input";
import { ContextIndicator } from "@/features/chat/components/context-indicator";
import { ModeSelector } from "@/components/mode-selector";
import { ModelSwitcher } from "@/features/models/components/model-switcher";
import { WorkingDirIndicator } from "@/features/code/components/working-dir-indicator";
import { PixaraView } from "@/features/pixara/components/pixara-view";
import { modelSupportsVision, modelSupportsToolUse } from "@/features/models/utils/capabilities";

export function ChatView() {
  const {
    activeConversationId,
    conversations,
    messages,
    isStreaming,
    createConversation,
    sendMessage,
    stopStreaming,
    setWorkingDirectory,
  } = useChatStore();

  const serverStatus = useModelStore((s) => s.serverStatus);
  const activeModel = useModelStore((s) => s.activeModel);
  const activeMode = useModeStore((s) => s.activeMode);

  const isModelLoaded = serverStatus === "ready" && activeModel !== null;

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );

  const activeFilename = activeModel?.split(/[/\\]/).pop() ?? "";

  // Check model capabilities
  const supportsVision = activeFilename ? modelSupportsVision(activeFilename) : false;
  const supportsToolUse = activeFilename ? modelSupportsToolUse(activeFilename) : false;

  if (!activeConversationId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-center border-b border-border px-4 py-2">
          <ModeSelector />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ChatCircle size={48} weight="light" />
            <h2 className="text-xl font-semibold text-foreground">
              Start a new conversation
            </h2>
            <p className="text-sm">
              {isModelLoaded
                ? "Click below to begin chatting with your model."
                : "Load a model first, then start chatting."}
            </p>
          </div>
          <button
            onClick={() => createConversation()}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>
      </div>
    );
  }

  // Pixara mode — show placeholder
  if (activeMode === "pixara") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-center border-b border-border px-4 py-2">
          <ModeSelector />
        </div>
        <PixaraView />
      </div>
    );
  }

  const isCodeMode = activeMode === "code";
  const needsWorkingDir = isCodeMode && !activeConversation?.workingDirectory;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: mode pill */}
      <div className="flex shrink-0 items-center justify-center border-b border-border px-4 py-2">
        <ModeSelector />
      </div>

      {/* Header bar: model switcher + context + actions */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <ModelSwitcher />
          {isCodeMode && activeConversation && (
            <WorkingDirIndicator
              workingDirectory={activeConversation.workingDirectory}
              onSelect={(path) => setWorkingDirectory(path)}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <ContextIndicator />
          <button
            onClick={() => createConversation()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus size={14} />
            New Chat
          </button>
        </div>
      </div>

      {/* Warning: non-tool_use model in code mode */}
      {isCodeMode && isModelLoaded && !supportsToolUse && (
        <div className="flex shrink-0 items-center gap-2 bg-warning/10 px-4 py-2 text-xs text-warning">
          <Warning size={14} className="shrink-0" />
          <span>
            <strong>{activeFilename}</strong> doesn't support tool use — the model
            won't be able to create or edit files. Switch to a model with tool use support.
          </span>
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} />
      <MessageInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isStreaming={isStreaming}
        disabled={!isModelLoaded || needsWorkingDir}
        placeholder={
          needsWorkingDir
            ? "Select a project folder to start coding..."
            : undefined
        }
        supportsVision={supportsVision}
      />
    </div>
  );
}
