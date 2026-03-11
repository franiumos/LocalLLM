import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, Conversation } from "@/features/chat/types/chat";
import type { AppMode } from "@/lib/types";

interface RustConversation {
  id: string;
  title: string;
  model_id: string;
  mode: string;
  working_directory: string | null;
  created_at: string;
  updated_at: string;
}

interface RustMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
  tool_calls: string | null;
  tool_result: string | null;
  attachments: string | null;
  image_url: string | null;
}

export async function fetchConversations(): Promise<Conversation[]> {
  const raw = await invoke<RustConversation[]>("list_conversations");
  return raw.map((r) => ({
    id: r.id,
    title: r.title,
    modelId: r.model_id,
    mode: (r.mode || "chat") as AppMode,
    workingDirectory: r.working_directory ?? undefined,
    messages: [],
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  }));
}

export async function createConversationInDb(
  conv: Conversation,
): Promise<void> {
  await invoke("create_conversation_cmd", {
    conversation: {
      id: conv.id,
      title: conv.title,
      model_id: conv.modelId,
      mode: conv.mode,
      working_directory: conv.workingDirectory ?? null,
      created_at: conv.createdAt.toISOString(),
      updated_at: conv.updatedAt.toISOString(),
    },
  });
}

export async function fetchMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const raw = await invoke<RustMessage[]>("get_conversation_messages", {
    conversationId,
  });
  return raw.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: new Date(m.created_at),
    toolCalls: m.tool_calls ? JSON.parse(m.tool_calls) : undefined,
    toolResult: m.tool_result ? JSON.parse(m.tool_result) : undefined,
    attachments: m.attachments ? JSON.parse(m.attachments) : undefined,
    imageUrl: m.image_url ?? undefined,
  }));
}

export async function saveMessageToDb(
  msg: ChatMessage,
  conversationId: string,
): Promise<void> {
  await invoke("save_message", {
    message: {
      id: msg.id,
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      created_at: msg.createdAt.toISOString(),
      tool_calls: msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
      tool_result: msg.toolResult ? JSON.stringify(msg.toolResult) : null,
      attachments: msg.attachments ? JSON.stringify(msg.attachments) : null,
      image_url: msg.imageUrl ?? null,
    },
  });
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  await invoke("update_conversation_title_cmd", { id, title });
}

export async function deleteConversationApi(id: string): Promise<void> {
  await invoke("delete_conversation_cmd", { id });
}

export async function deleteAllConversationsApi(): Promise<void> {
  await invoke("delete_all_conversations_cmd");
}
