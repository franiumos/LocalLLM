import { LLAMA_SERVER_URL } from "@/lib/constants";

export async function* streamChatCompletion(
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[],
  params: { temperature: number; topP: number; maxTokens: number },
  signal: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${LLAMA_SERVER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body from server");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line for next chunk

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function chatCompletionWithTools(
  messages: { role: string; content: string; tool_calls?: unknown; tool_call_id?: string }[],
  tools: unknown[],
  params: { temperature: number; topP: number; maxTokens: number },
  signal: AbortSignal,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const response = await fetch(`${LLAMA_SERVER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      tools,
      temperature: params.temperature,
      top_p: params.topP,
      max_tokens: params.maxTokens,
      stream: false,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return response.json();
}

export async function countTokens(text: string): Promise<number> {
  try {
    const response = await fetch(`${LLAMA_SERVER_URL}/tokenize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.tokens?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const resp = await fetch(`${LLAMA_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
