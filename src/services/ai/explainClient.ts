import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { AiSettings } from "./aiSettings";
import {
  EXPLAIN_USER_MESSAGE,
  buildExplainSystemPrompt,
} from "./explainPromptBuilder";
import { ExplainResult, ExplainResultSchema } from "./explainSchema";

export interface ExplainRequest {
  selectedText: string;
  context: string;
}

export interface FetchExplainOptions {
  abortSignal?: AbortSignal;
  onStreamText?: (text: string) => void;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("AI API key is not configured. Please open the extension options and set it up.");
    this.name = "MissingApiKeyError";
  }
}

function buildProvider(settings: AiSettings) {
  if (!settings.apiKey) {
    throw new MissingApiKeyError();
  }
  return createOpenAICompatible({
    name: "listenup-ai",
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey,
    supportsStructuredOutputs: true,
  });
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start < 0 || end < 0 || end <= start) {
    return candidate.trim();
  }

  return candidate.slice(start, end + 1);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldFallbackToTextMode(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return [
    "invalid json",
    "json",
    "schema",
    "structured",
    "response_format",
    "tool",
    "type validation",
  ].some((token) => message.includes(token));
}

async function fetchExplainFromTextStream(
  settings: AiSettings,
  req: ExplainRequest,
  options: FetchExplainOptions = {}
): Promise<ExplainResult> {
  const provider = buildProvider(settings);
  const result = streamText({
    model: provider(settings.model),
    system: buildExplainSystemPrompt(req),
    prompt: EXPLAIN_USER_MESSAGE,
    abortSignal: options.abortSignal,
  });

  let streamedText = "";
  for await (const textPart of result.textStream) {
    streamedText += textPart;
    options.onStreamText?.(streamedText);
  }

  const raw = extractJson(streamedText);

  try {
    return ExplainResultSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error(
      `Model returned text, but it was not valid JSON. Raw: ${streamedText.slice(0, 200)}`
    );
  }
}

export async function fetchExplain(
  settings: AiSettings,
  req: ExplainRequest,
  options: FetchExplainOptions = {}
): Promise<ExplainResult> {
  try {
    return await fetchExplainFromTextStream(settings, req, options);
  } catch (error) {
    if (options.abortSignal?.aborted) {
      throw error;
    }

    if (!shouldFallbackToTextMode(error)) {
      throw error;
    }

    return fetchExplainFromTextStream(settings, req, options);
  }
}

export async function testAiConnection(settings: AiSettings): Promise<{
  ok: true;
  sample: ExplainResult;
} | {
  ok: false;
  error: string;
}> {
  try {
    const sample = await fetchExplain(settings, {
      selectedText: "hello",
      context: "She waved and said hello.",
    });
    return { ok: true, sample };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error)?.message ?? String(error),
    };
  }
}
