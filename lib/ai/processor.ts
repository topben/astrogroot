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

const SUMMARIZE_SYSTEM_PROMPT = `You are an expert aerospace engineering and space science researcher specializing in rocket propulsion, launch systems, and astronautics. Your task is to produce high-value research summaries optimized for knowledge retrieval and semantic search.

DOMAIN EXPERTISE:
Focus areas include: rocket engines, propulsion systems, turbopumps, combustion, nozzle design, guidance navigation and control, thermal protection, aerodynamics, orbital mechanics, spacecraft systems, astronomy, astrophysics, and space exploration.

SUMMARY STRUCTURE (Emerald-Style Compound Abstract):

1. PURPOSE / BACKGROUND
   - State the research problem, knowledge gap, or scientific significance
   - Explain why this research matters and its relevance to the field
   - Identify the specific objectives or questions addressed

2. METHODOLOGY / APPROACH
   - Describe the research design, data sources, and analytical framework
   - Specify experimental setup, simulations, observations, or theoretical models
   - Note key instruments, facilities, missions, or datasets used

3. FINDINGS / RESULTS
   - Present main discoveries, measurements, or outcomes clearly and precisely
   - Include quantitative results where available (performance metrics, measurements)
   - Highlight patterns, comparisons, or unexpected findings

4. ORIGINALITY / IMPLICATIONS
   - Articulate the study's novelty and contribution to the field
   - Explain practical applications: engineering, mission planning, technology development
   - Suggest future research directions or open questions

WRITING GUIDELINES:
- Maximize keyword density for searchability: use specific technical terms (e.g., "LOX/LH2 turbopump", "regenerative cooling", "Mach number")
- Include synonyms and related terms to improve retrieval (e.g., "rocket engine" and "propulsion system")
- Maintain strict scientific accuracy with clear, accessible language
- Keep information-dense: 3-4 coherent paragraphs, 200-350 words
- NEVER alter personal names (authors, researchers)
- On first mention of proper nouns (missions, instruments, institutions), keep original term
- Avoid speculation not supported by the source material`;

const TRANSLATE_SYSTEM_PROMPT = `You are a professional aerospace and astronomy translator with expertise in rocket propulsion, space systems, and astrophysics terminology.

TRANSLATION RULES (STRICT):

1. PERSONAL NAMES
   - NEVER translate or alter personal names (authors, researchers, astronauts)
   - Keep original: "von Braun", "錢學森 (Qian Xuesen)" → keep as-is

2. TECHNICAL TERMS & PROPER NOUNS
   - Translate the term, then append the original in parentheses on FIRST mention
   - Examples:
     • "turbopump" → 「渦輪泵（turbopump）」
     • "regenerative cooling" → 「再生冷卻（regenerative cooling）」
     • "SpaceX Starship" → 「SpaceX 星艦（Starship）」
     • "NASA NTRS" → 「NASA 技術報告伺服器（NTRS）」

3. PRESERVE STRUCTURE
   - Maintain the 4-part structure: Purpose, Methodology, Findings, Implications
   - Keep parallel sentence structure and logical flow
   - Preserve all quantitative data and measurements exactly

4. LANGUAGE QUALITY
   - Use formal academic tone appropriate for the target language
   - Ensure terminological consistency throughout
   - Adapt idioms naturally while preserving technical precision
   - For Traditional Chinese: use 「」for quotations, maintain technical register
   - For Simplified Chinese: use ""for quotations, follow mainland conventions`;

export async function summarizeText(params: {
  text: string;
  title: string;
  sourceType: "paper" | "video" | "article";
  maxLength?: number;
}): Promise<string> {
  const { text, title, sourceType, maxLength } = params;

  const sourceLabel = {
    paper: "research paper/technical report",
    video: "educational video or lecture",
    article: "article or news item",
  }[sourceType];

  const prompt = `Analyze and summarize this ${sourceLabel}:

TITLE: "${title}"

CONTENT:
${text.slice(0, 50000)}${text.length > 50000 ? "\n[Content truncated...]" : ""}

Generate a structured summary following the Emerald-style format:
1. PURPOSE: Research problem, objectives, and significance
2. METHODOLOGY: Approach, data, methods, or analytical framework
3. FINDINGS: Key results, discoveries, or insights
4. IMPLICATIONS: Contributions, applications, and future directions

${maxLength ? `Target length: approximately ${maxLength} words.` : "Keep concise but comprehensive (200-350 words)."}

Optimize for semantic search by including relevant technical keywords.`;

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
  const prompt = `Extract the ${count} most important technical keywords and key concepts from this aerospace/space science content.

Focus on:
- Specific technologies (e.g., "regenerative cooling", "turbopump cavitation")
- Propulsion types (e.g., "LOX/RP-1", "solid rocket motor", "electric propulsion")
- Missions, spacecraft, or instruments mentioned
- Physical phenomena or measurements
- Engineering parameters or performance metrics

${text.slice(0, 30000)}

Return only a numbered list of key terms/concepts, each 1-5 words, optimized for search indexing.`;

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
