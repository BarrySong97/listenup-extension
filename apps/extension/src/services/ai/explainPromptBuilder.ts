export interface ExplainPromptInput {
  selectedText: string;
  context: string;
}

function classifySelection(text: string): "word" | "phrase" | "sentence" {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 1) return "word";
  if (wordCount <= 5 && !/[.!?]/.test(trimmed)) return "phrase";
  return "sentence";
}

export function buildExplainSystemPrompt({
  selectedText,
  context,
}: ExplainPromptInput): string {
  const kind = classifySelection(selectedText);

  const partOfSpeechLine =
    kind === "word"
      ? '- Because the selection is a single word, set "partOfSpeech" to the most likely part of speech in this exact context (e.g. noun, verb, adjective).'
      : '- Because the selection is not a single word, return an empty string for "partOfSpeech".';

  const detailHint =
    kind === "sentence"
      ? "Explain the sentence's overall meaning and any idiomatic or tricky parts."
      : kind === "phrase"
      ? "Explain how the phrase functions as a unit in this context."
      : "Explain the word's exact meaning in this context and common usage patterns.";

  return [
    "You are a helpful reading assistant that explains English selections to language learners.",
    `The user selected: "${selectedText}"`,
    `Context sentence:\n---\n${context}\n---`,
    "",
    "Return ONLY a JSON object (no markdown, no code fence) with this exact schema:",
    "{",
    '  "partOfSpeech": "string",',
    '  "phonetics": { "us": "string", "uk": "string" },',
    '  "meaningExplain": "string",',
    '  "detailExplain": ["string", "string"]',
    "}",
    "",
    "Constraints:",
    "- Keep each string concise and practical.",
    "- Focus on this exact context, not generic dictionary entries.",
    "- Keep detailExplain to 2-3 short bullets.",
    `- ${detailHint}`,
    partOfSpeechLine,
    '- For "phonetics", provide IPA strings WITHOUT slashes. "us" is General American, "uk" is Received Pronunciation. If unsure about one accent, return an empty string.',
    '- For multi-word selections, give phonetics for the whole selection read naturally, or return empty strings if impractical.',
  ].join("\n");
}

export const EXPLAIN_USER_MESSAGE = "Explain this selection.";
