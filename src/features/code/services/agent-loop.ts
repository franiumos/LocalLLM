import { chatCompletionWithTools, streamChatCompletion } from "@/features/chat/api/inference-api";
import { executeTool } from "@/features/code/api/tool-api";
import type { ToolDefinition } from "@/features/code/types/tools";
import type { ChatMessage, ToolCall, ToolResult } from "@/features/chat/types/chat";
import { generateId } from "@/lib/utils";

interface InferenceParams {
  temperature: number;
  topP: number;
  maxTokens: number;
}

interface AgentCallbacks {
  onToolCallMessage: (message: ChatMessage) => void;
  onToolResultMessage: (message: ChatMessage) => void;
  onAssistantToken: (token: string) => void;
  onAssistantMessage: (message: ChatMessage) => void;
}

type ApiMessage = {
  role: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

const MAX_ITERATIONS = 10;

export async function runAgentLoop(
  initialMessages: ApiMessage[],
  tools: ToolDefinition[],
  workingDirectory: string,
  params: InferenceParams,
  signal: AbortSignal,
  callbacks: AgentCallbacks,
): Promise<ChatMessage[]> {
  const allMessages = [...initialMessages];
  const newChatMessages: ChatMessage[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const response = await chatCompletionWithTools(
      allMessages,
      tools,
      params,
      signal,
    );

    const choice = response.choices?.[0];
    if (!choice) break;

    const message = choice.message;

    // Check if model wants to use tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      // Create assistant message with tool calls
      const toolCalls: ToolCall[] = message.tool_calls.map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }),
      );

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: message.content || "",
        createdAt: new Date(),
        toolCalls,
      };
      newChatMessages.push(assistantMsg);
      callbacks.onToolCallMessage(assistantMsg);

      // Add assistant message to API history
      allMessages.push({
        role: "assistant",
        content: message.content || "",
        tool_calls: message.tool_calls,
      });

      // Execute each tool call
      for (const tc of message.tool_calls) {
        let resultContent: string;
        let isError = false;

        try {
          const result = await executeTool(
            tc.function.name,
            tc.function.arguments,
            workingDirectory,
          );
          resultContent = result.output;
          isError = !result.success;
        } catch (error) {
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
          isError = true;
        }

        const toolResult: ToolResult = {
          toolCallId: tc.id,
          name: tc.function.name,
          content: resultContent,
          isError,
        };

        const toolMsg: ChatMessage = {
          id: generateId(),
          role: "tool",
          content: resultContent,
          createdAt: new Date(),
          toolResult,
        };
        newChatMessages.push(toolMsg);
        callbacks.onToolResultMessage(toolMsg);

        // Add tool result to API history
        allMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultContent,
        });
      }
    } else {
      // No tool calls — this is the final text response
      // Stream it for better UX
      let accumulatedContent = "";
      const finalMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      newChatMessages.push(finalMsg);
      callbacks.onAssistantMessage(finalMsg);

      // Re-request with streaming (without tools) to get a natural response
      try {
        const stream = streamChatCompletion(
          allMessages,
          params,
          signal,
        );

        for await (const token of stream) {
          accumulatedContent += token;
          callbacks.onAssistantToken(token);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // User stopped
        } else {
          accumulatedContent = message.content || "Error getting response.";
        }
      }

      // Update the message in our returned array with final content
      // (store already has the content via onAssistantToken callbacks)
      finalMsg.content = accumulatedContent;

      break;
    }
  }

  return newChatMessages;
}
