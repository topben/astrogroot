import Anthropic from "@anthropic-ai/sdk";

const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

export const anthropic = new Anthropic({
  apiKey,
});

// Use ANTHROPIC_MODEL in .env to override (e.g. claude-3-5-sonnet-20240620)
export const DEFAULT_MODEL =
  Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20240620";
export const MAX_TOKENS = 4096;

export type Message = {
  role: "user" | "assistant";
  content: string;
};

export async function sendMessage(params: {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || MAX_TOKENS,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: params.messages,
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    }

    throw new Error("Unexpected response type from Claude");
  } catch (error) {
    console.error("Error sending message to Claude:", error);
    throw error;
  }
}

export async function streamMessage(params: {
  messages: Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  onChunk?: (text: string) => void;
}): Promise<string> {
  try {
    const stream = await anthropic.messages.create({
      model: params.model || DEFAULT_MODEL,
      max_tokens: params.maxTokens || MAX_TOKENS,
      temperature: params.temperature || 0.7,
      system: params.systemPrompt,
      messages: params.messages,
      stream: true,
    });

    let fullResponse = "";

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullResponse += text;
        if (params.onChunk) {
          params.onChunk(text);
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("Error streaming message from Claude:", error);
    throw error;
  }
}
