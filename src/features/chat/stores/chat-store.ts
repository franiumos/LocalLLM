import { create } from "zustand";
import type {
  ChatMessage,
  Conversation,
  FileAttachment,
} from "@/features/chat/types/chat";
import { streamChatCompletion, countTokens } from "@/features/chat/api/inference-api";
import {
  fetchConversations,
  createConversationInDb,
  fetchMessages,
  saveMessageToDb,
  updateConversationTitle,
  deleteConversationApi,
} from "@/features/chat/api/conversation-api";
import { generateId } from "@/lib/utils";
import {
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS,
} from "@/lib/constants";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { useModeStore } from "@/stores/mode-store";
import { runAgentLoop } from "@/features/code/services/agent-loop";
import { CODE_MODE_TOOLS } from "@/features/code/types/tools";
import { getCodeAgentSystemPrompt } from "@/features/code/constants/system-prompt";
import type { AppMode } from "@/lib/types";
import { useModelStore } from "@/features/models/stores/model-store";
import { modelSupportsVision } from "@/features/models/utils/capabilities";

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  abortController: AbortController | null;
  contextTokens: number;
  contextLimit: number;

  loadConversations: () => Promise<void>;
  createConversation: (mode?: AppMode) => void;
  sendMessage: (content: string, attachments?: FileAttachment[]) => Promise<void>;
  stopStreaming: () => void;
  addMessageToActive: (message: ChatMessage) => void;
  setStreaming: (val: boolean) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  deleteAllConversations: () => void;
  updateTokenCount: () => Promise<void>;
  setWorkingDirectory: (dir: string) => void;
}

function isChatHistoryEnabled(): boolean {
  return useSettingsStore.getState().settings?.privacy.save_chat_history ?? true;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  abortController: null,
  contextTokens: 0,
  contextLimit: 0,

  loadConversations: async () => {
    try {
      const conversations = await fetchConversations();
      set({ conversations });
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  },

  createConversation: (mode?: AppMode) => {
    const activeMode = mode ?? useModeStore.getState().activeMode;
    const id = generateId();
    const now = new Date();
    const conversation: Conversation = {
      id,
      title: "New Conversation",
      modelId: "",
      messages: [],
      createdAt: now,
      updatedAt: now,
      mode: activeMode,
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id,
      messages: [],
      contextTokens: 0,
    }));

    if (isChatHistoryEnabled()) {
      createConversationInDb(conversation).catch((e) =>
        console.error("Failed to persist conversation:", e),
      );
    }
  },

  sendMessage: async (content: string, attachments?: FileAttachment[]) => {
    const state = get();
    if (!state.activeConversationId || state.isStreaming) return;

    const conversation = state.conversations.find(
      (c) => c.id === state.activeConversationId,
    );
    if (!conversation) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      createdAt: new Date(),
      attachments,
    };

    const isFirstMessage = conversation.messages.length === 0;
    const newTitle = isFirstMessage
      ? content.slice(0, 40) + (content.length > 40 ? "..." : "")
      : undefined;

    const updatedMessages = [...state.messages, userMessage];
    set((s) => ({
      messages: updatedMessages,
      conversations: s.conversations.map((c) =>
        c.id === s.activeConversationId
          ? {
              ...c,
              messages: updatedMessages,
              updatedAt: new Date(),
              title: newTitle ?? c.title,
            }
          : c,
      ),
    }));

    const abortController = new AbortController();
    set({ isStreaming: true, abortController });

    const inference = useSettingsStore.getState().settings?.inference;
    const params = {
      temperature: inference?.temperature ?? DEFAULT_TEMPERATURE,
      topP: inference?.top_p ?? DEFAULT_TOP_P,
      maxTokens: inference?.max_tokens ?? DEFAULT_MAX_TOKENS,
    };

    try {
      if (conversation.mode === "code" && conversation.workingDirectory) {
        // CODE MODE — agentic loop
        await sendCodeModeMessage(
          get,
          set,
          updatedMessages,
          conversation,
          params,
          abortController.signal,
        );
      } else {
        // CHAT MODE — regular streaming
        await sendChatModeMessage(
          get,
          set,
          updatedMessages,
          attachments,
          params,
          abortController.signal,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // User stopped streaming
      } else {
        console.error("Message error:", error);
      }
    } finally {
      const finalMessages = get().messages;
      const convId = get().activeConversationId;

      set((s) => ({
        isStreaming: false,
        abortController: null,
        conversations: s.conversations.map((c) =>
          c.id === s.activeConversationId
            ? { ...c, messages: finalMessages, updatedAt: new Date() }
            : c,
        ),
      }));

      // Persist messages to DB
      if (convId && isChatHistoryEnabled()) {
        saveMessageToDb(userMessage, convId).catch((e) =>
          console.error("Failed to save user message:", e),
        );

        // Save all new messages (assistant + tool messages)
        const userIdx = finalMessages.findIndex((m) => m.id === userMessage.id);
        const newMsgs = finalMessages.slice(userIdx + 1);
        for (const msg of newMsgs) {
          saveMessageToDb(msg, convId).catch((e) =>
            console.error("Failed to save message:", e),
          );
        }

        if (newTitle) {
          updateConversationTitle(convId, newTitle).catch((e) =>
            console.error("Failed to update title:", e),
          );
        }
      }

      get().updateTokenCount();
    }
  },

  stopStreaming: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
  },

  addMessageToActive: (message: ChatMessage) => {
    set((state) => ({
      messages: [...state.messages, message],
      conversations: state.conversations.map((c) =>
        c.id === state.activeConversationId
          ? {
              ...c,
              messages: [...c.messages, message],
              updatedAt: new Date(),
            }
          : c,
      ),
    }));
  },

  setStreaming: (val: boolean) => {
    set({ isStreaming: val });
  },

  loadConversation: async (id: string) => {
    const conversation = get().conversations.find((c) => c.id === id);
    if (!conversation) return;

    // Switch to the conversation's mode
    useModeStore.getState().setMode(conversation.mode);

    if (conversation.messages.length === 0) {
      try {
        const messages = await fetchMessages(id);
        set((s) => ({
          activeConversationId: id,
          messages,
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages } : c,
          ),
        }));
      } catch {
        set({ activeConversationId: id, messages: [] });
      }
    } else {
      set({
        activeConversationId: id,
        messages: conversation.messages,
      });
    }

    get().updateTokenCount();
  },

  deleteConversation: (id: string) => {
    const { activeConversationId, conversations } = get();
    const filtered = conversations.filter((c) => c.id !== id);
    const needsSwitch = activeConversationId === id;

    set({
      conversations: filtered,
      ...(needsSwitch
        ? {
            activeConversationId: filtered[0]?.id ?? null,
            messages: filtered[0]?.messages ?? [],
            contextTokens: 0,
          }
        : {}),
    });

    deleteConversationApi(id).catch((e) =>
      console.error("Failed to delete conversation:", e),
    );
  },

  deleteAllConversations: () => {
    const activeMode = useModeStore.getState().activeMode;
    const { conversations, activeConversationId } = get();

    // Only delete conversations matching the active mode
    const toKeep = conversations.filter((c) => c.mode !== activeMode);
    const toDelete = conversations.filter((c) => c.mode === activeMode);

    const activeIsDeleted = toDelete.some((c) => c.id === activeConversationId);

    set({
      conversations: toKeep,
      ...(activeIsDeleted
        ? {
            activeConversationId: toKeep[0]?.id ?? null,
            messages: toKeep[0]?.messages ?? [],
            contextTokens: 0,
          }
        : {}),
    });

    // Delete each removed conversation from the database
    for (const conv of toDelete) {
      deleteConversationApi(conv.id).catch((e) =>
        console.error("Failed to delete conversation:", e),
      );
    }
  },

  setWorkingDirectory: (dir: string) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === s.activeConversationId
          ? { ...c, workingDirectory: dir }
          : c,
      ),
    }));
  },

  updateTokenCount: async () => {
    const { messages } = get();
    if (messages.length === 0) {
      set({ contextTokens: 0, contextLimit: 0 });
      return;
    }

    const limit =
      useSettingsStore.getState().settings?.inference.context_size ?? 4096;
    const fullText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const count = await countTokens(fullText);
    set({ contextTokens: count, contextLimit: limit });
  },
}));

// --- Helper: Chat Mode (regular streaming) ---
async function sendChatModeMessage(
  _get: () => ChatState,
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  updatedMessages: ChatMessage[],
  _attachments: FileAttachment[] | undefined,
  params: { temperature: number; topP: number; maxTokens: number },
  signal: AbortSignal,
) {
  const assistantMessage: ChatMessage = {
    id: generateId(),
    role: "assistant",
    content: "",
    createdAt: new Date(),
  };

  set((s) => ({
    messages: [...s.messages, assistantMessage],
  }));

  const inference = useSettingsStore.getState().settings?.inference;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiMessages: any[] = [];

  if (inference?.system_prompt) {
    apiMessages.push({ role: "system", content: inference.system_prompt });
  }

  // Check if current model supports vision
  const activeModel = useModelStore.getState().activeModel;
  const activeFilename = activeModel?.split(/[/\\]/).pop() ?? "";
  const hasVision = modelSupportsVision(activeFilename);

  for (const m of updatedMessages) {
    const hasImageAttachments = m.attachments?.some((a) => a.type === "image");

    if (hasImageAttachments && hasVision) {
      // Vision model: send images as multimodal content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentParts: any[] = [{ type: "text", text: m.content }];
      for (const att of m.attachments!) {
        if (att.type === "image") {
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:${att.mimeType ?? "image/png"};base64,${att.content}` },
          });
        }
      }
      apiMessages.push({ role: m.role, content: contentParts });
    } else {
      // Non-vision or text-only: include text files as content, images as filename only
      let messageContent = m.content;
      if (m.attachments) {
        const textParts = m.attachments
          .filter((a) => a.type === "text")
          .map((a) => `\n\n--- File: ${a.name} ---\n${a.content}`)
          .join("");
        const imageParts = m.attachments
          .filter((a) => a.type === "image")
          .map((a) => `[Attached image: ${a.name}]`)
          .join(" ");
        if (textParts) messageContent += textParts;
        if (imageParts) messageContent += `\n\n${imageParts}`;
      }
      apiMessages.push({ role: m.role, content: messageContent });
    }
  }

  const stream = streamChatCompletion(apiMessages, params, signal);

  for await (const token of stream) {
    set((s) => {
      const msgs = [...s.messages];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        msgs[msgs.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + token,
        };
      }
      return { ...s, messages: msgs };
    });
  }
}

// --- Helper: Code Mode (agentic loop) ---
async function sendCodeModeMessage(
  _get: () => ChatState,
  set: (fn: (s: ChatState) => Partial<ChatState>) => void,
  updatedMessages: ChatMessage[],
  conversation: Conversation,
  params: { temperature: number; topP: number; maxTokens: number },
  signal: AbortSignal,
) {
  const workingDirectory = conversation.workingDirectory!;

  // Build API messages with system prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiMessages: any[] = [
    { role: "system", content: getCodeAgentSystemPrompt(workingDirectory) },
  ];

  for (const m of updatedMessages) {
    if (m.role === "tool" && m.toolResult) {
      apiMessages.push({
        role: "tool",
        tool_call_id: m.toolResult.toolCallId,
        content: m.content,
      });
    } else if (m.role === "assistant" && m.toolCalls) {
      apiMessages.push({
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  }

  await runAgentLoop(
    apiMessages,
    CODE_MODE_TOOLS,
    workingDirectory,
    params,
    signal,
    {
      onToolCallMessage: (msg) => {
        set((s) => ({
          ...s,
          messages: [...s.messages, msg],
        }));
      },
      onToolResultMessage: (msg) => {
        set((s) => ({
          ...s,
          messages: [...s.messages, msg],
        }));
      },
      onAssistantMessage: (msg) => {
        set((s) => ({
          ...s,
          messages: [...s.messages, msg],
        }));
      },
      onAssistantToken: (token) => {
        set((s) => {
          const msgs = [...s.messages];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...lastMsg,
              content: lastMsg.content + token,
            };
          }
          return { ...s, messages: msgs };
        });
      },
    },
  );
}
