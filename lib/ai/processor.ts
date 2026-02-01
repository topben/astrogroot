import { sendMessage } from "./client.ts";

/** Supported content languages for summaries/translations (aligned with i18n locales). */
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "zh-TW", name: "Traditional Chinese" },
  { code: "zh-CN", name: "Simplified Chinese" },
] as const;

export interface ProcessingResult {
  summary: string;
  translation?: string;
  keyPoints?: string[];
}

export interface MultilingualTranslation {
  lang: string;
  title: string;
  summary: string;
}

export interface ProcessMultilingualResult {
  baseSummary: string;
  translations: MultilingualTranslation[];
}

const SUMMARIZE_SYSTEM_PROMPT = `You are an expert astronomy and space science communicator. Your task is to summarize research papers, articles, and video content in a clear, accessible way while maintaining scientific accuracy.

Guidelines:
- Focus on the main findings, methodology, and significance
- Use clear language accessible to enthusiasts while preserving technical accuracy
- Highlight practical applications or implications
- Keep summaries concise but informative (2-4 paragraphs)
- Identify key concepts and breakthrough findings`;

const TRANSLATE_SYSTEM_PROMPT = `You are a professional translator specializing in astronomy and space science content. Translate the following summary while:
- Maintaining scientific accuracy and terminology
- Adapting idioms and expressions appropriately
- Preserving the structure and key points
- Using natural, fluent language in the target language`;

export async function summarizeText(params: {
  text: string;
  title: string;
  sourceType: "paper" | "video" | "article";
  maxLength?: number;
}): Promise<string> {
  const { text, title, sourceType, maxLength } = params;

  const prompt = `Summarize this ${sourceType} about "${title}".

Content:
${text.slice(0, 50000)} ${text.length > 50000 ? "..." : ""}

Provide a ${maxLength ? `${maxLength}-word` : "concise"} summary that captures the main points, methodology, and significance.`;

  try {
    const summary = await sendMessage({
      messages: [{ role: "user", content: prompt }],
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      temperature: 0.7,
    });

    return summary.trim();
  } catch (error) {
    console.error("Error summarizing text:", error);
    throw error;
  }
}

export async function translateSummary(params: {
  summary: string;
  targetLanguage: string;
}): Promise<string> {
  const { summary, targetLanguage } = params;

  const prompt = `Translate the following astronomy/space science summary to ${targetLanguage}:

${summary}`;

  try {
    const translation = await sendMessage({
      messages: [{ role: "user", content: prompt }],
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
      temperature: 0.5,
    });

    return translation.trim();
  } catch (error) {
    console.error("Error translating summary:", error);
    throw error;
  }
}

/** Translate a short text (e.g. title) to the target language. */
export async function translateText(text: string, targetLanguage: string): Promise<string> {
  const prompt = `Translate the following astronomy/space science title or short text to ${targetLanguage}. Return only the translation, no explanation.

${text}`;

  try {
    const translation = await sendMessage({
      messages: [{ role: "user", content: prompt }],
      systemPrompt: TRANSLATE_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    return translation.trim();
  } catch (error) {
    console.error("Error translating text:", error);
    throw error;
  }
}

export async function extractKeyPoints(text: string, count = 5): Promise<string[]> {
  const prompt = `Extract the ${count} most important key points from this astronomy/space science content:

${text.slice(0, 30000)}

Return only a numbered list of key points.`;

  try {
    const response = await sendMessage({
      messages: [{ role: "user", content: prompt }],
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      temperature: 0.5,
    });

    // Parse numbered list into array
    const keyPoints = response
      .split("\n")
      .filter((line) => /^\d+\./.test(line.trim()))
      .map((line) => line.replace(/^\d+\.\s*/, "").trim());

    return keyPoints.slice(0, count);
  } catch (error) {
    console.error("Error extracting key points:", error);
    throw error;
  }
}

export async function processContent(params: {
  text: string;
  title: string;
  sourceType: "paper" | "video" | "article";
  translateTo?: string;
  extractKeyPoints?: boolean;
}): Promise<ProcessingResult> {
  const { text, title, sourceType, translateTo, extractKeyPoints: shouldExtractKeyPoints } =
    params;

  console.log(`Processing ${sourceType}: ${title}`);

  // Generate summary
  const summary = await summarizeText({
    text,
    title,
    sourceType,
  });

  console.log(`Summary generated (${summary.length} chars)`);

  const result: ProcessingResult = { summary };

  // Translate if requested
  if (translateTo) {
    result.translation = await translateSummary({
      summary,
      targetLanguage: translateTo,
    });
    console.log(`Translation to ${translateTo} completed`);
  }

  // Extract key points if requested
  if (shouldExtractKeyPoints) {
    result.keyPoints = await extractKeyPoints(text);
    console.log(`Extracted ${result.keyPoints.length} key points`);
  }

  return result;
}

/** Summarize in base language (English), then translate title + summary to all supported languages. */
export async function processMultilingualContent(params: {
  text: string;
  title: string;
  sourceType: "paper" | "video" | "article";
}): Promise<ProcessMultilingualResult> {
  const { text, title, sourceType } = params;

  console.log(`Processing multilingual ${sourceType}: ${title.substring(0, 50)}...`);

  const baseSummary = await summarizeText({
    text,
    title,
    sourceType,
  });

  const targetLangs = SUPPORTED_LANGUAGES.filter((l) => l.code !== "en");
  const translations: MultilingualTranslation[] = [
    { lang: "en", title, summary: baseSummary },
  ];

  const translated = await Promise.all(
    targetLangs.map(async (lang) => ({
      lang: lang.code,
      title: await translateText(title, lang.name),
      summary: await translateSummary({ summary: baseSummary, targetLanguage: lang.name }),
    })),
  );

  for (const t of translated) {
    translations.push({ lang: t.lang, title: t.title, summary: t.summary });
  }

  return { baseSummary, translations };
}

export async function answerQuestion(params: {
  question: string;
  context: string;
  title: string;
}): Promise<string> {
  const { question, context, title } = params;

  const systemPrompt = `You are an expert astronomy assistant. Answer questions based on the provided context from "${title}". If the answer isn't in the context, say so clearly.`;

  const prompt = `Context:
${context.slice(0, 40000)}

Question: ${question}`;

  try {
    const answer = await sendMessage({
      messages: [{ role: "user", content: prompt }],
      systemPrompt,
      temperature: 0.7,
    });

    return answer.trim();
  } catch (error) {
    console.error("Error answering question:", error);
    throw error;
  }
}
