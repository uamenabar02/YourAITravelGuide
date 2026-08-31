import { GoogleGenAI, Type } from "@google/genai";
import {
  AISelectionSettings,
  AITaskCategory,
  UserAIModelConfig,
  AIGenerationMetadata,
  AIAttemptLog,
} from "../src/types.js";

const SYSTEM_MODELS_MAP: Record<string, UserAIModelConfig> = {
  "system-gemini-3.6": {
    id: "system-gemini-3.6",
    provider: "system_gemini",
    name: "Gemini 3.6 Flash (System)",
    modelId: "gemini-3.6-flash",
    isSystem: true,
  },
  "system-gemini-3.5": {
    id: "system-gemini-3.5",
    provider: "system_gemini",
    name: "Gemini 3.5 Flash-Lite (Speed)",
    modelId: "gemini-3.5-flash-lite",
    isSystem: true,
  },
  "system-gemini-2.5-pro": {
    id: "system-gemini-2.5-pro",
    provider: "system_gemini",
    name: "Gemini 2.5 Pro (Deep Reasoning)",
    modelId: "gemini-2.5-pro",
    isSystem: true,
  },
};

export interface ExecuteAIOptions<T> {
  aiSettings?: AISelectionSettings;
  taskCategory: AITaskCategory;
  prompt: string;
  systemInstruction: string;
  responseSchema?: any;
  fallbackGenerator?: () => T | Promise<T>;
}

function safeParseOrRepairJson<T>(text: string): T {
  if (!text || typeof text !== "string") {
    throw new Error("Empty or non-string response to parse");
  }
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.trim();

  // Step 1: Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Continue
  }

  // Step 2: Attempt between outer braces / brackets
  const startObj = cleaned.indexOf("{");
  const startArr = cleaned.indexOf("[");
  let startIdx = -1;
  if (startObj !== -1 && startArr !== -1) {
    startIdx = Math.min(startObj, startArr);
  } else if (startObj !== -1) {
    startIdx = startObj;
  } else if (startArr !== -1) {
    startIdx = startArr;
  }

  if (startIdx !== -1) {
    const sub = cleaned.substring(startIdx);
    const endObj = sub.lastIndexOf("}");
    const endArr = sub.lastIndexOf("]");
    const endIdx = Math.max(endObj, endArr);
    if (endIdx > 0) {
      const candidate = sub.substring(0, endIdx + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Try fixing common trailing commas and unicode quotes before brackets
        try {
          const fixed = candidate
            .replace(/,\s*([\]}])/g, "$1")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'");
          return JSON.parse(fixed) as T;
        } catch {
          // Continue to progressive repair
        }
      }
    }
  }

  // Step 3: Progressive repair for truncated or cut-off JSON output
  const baseSub = startIdx !== -1 ? cleaned.substring(startIdx) : cleaned;
  for (let len = baseSub.length; len > 10; len -= 5) {
    let chunk = baseSub.substring(0, len);

    let inString = false;
    let escaped = false;
    const stack: string[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const char = chunk[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === "{" || char === "[") {
          stack.push(char);
        } else if (char === "}") {
          if (stack.length > 0 && stack[stack.length - 1] === "{") stack.pop();
        } else if (char === "]") {
          if (stack.length > 0 && stack[stack.length - 1] === "[") stack.pop();
        }
      }
    }

    if (inString) {
      chunk += '"';
    }

    // Remove any trailing commas or dangling colons/keys
    chunk = chunk.replace(/,\s*$/, "").replace(/:\s*$/, ': ""');

    while (stack.length > 0) {
      const open = stack.pop();
      if (open === "{") chunk += "}";
      else if (open === "[") chunk += "]";
    }

    // Remove trailing commas inside objects/arrays
    chunk = chunk.replace(/,\s*([\]}])/g, "$1");

    try {
      return JSON.parse(chunk) as T;
    } catch {
      // Step back and try shorter slice
    }
  }

  throw new Error(`Failed to parse or repair JSON text (length ${text.length})`);
}

export async function executeAICompletion<T>(
  options: ExecuteAIOptions<T>
): Promise<{ data: T; meta: AIGenerationMetadata }> {
  const { aiSettings, taskCategory, prompt, systemInstruction, responseSchema, fallbackGenerator } = options;

  // Determine model hierarchy
  let primaryId = "system-gemini-3.6";
  let fallback1Id = "system-gemini-3.5";
  let fallback2Id = "system-gemini-2.5-pro";

  if (aiSettings) {
    if (aiSettings.mode === "advanced" && aiSettings.advanced?.[taskCategory]) {
      const adv = aiSettings.advanced[taskCategory];
      if (adv.primaryModelId) primaryId = adv.primaryModelId;
      if (adv.fallbackModel1Id) fallback1Id = adv.fallbackModel1Id;
      if (adv.fallbackModel2Id) fallback2Id = adv.fallbackModel2Id;
    } else if (aiSettings.basic) {
      if (aiSettings.basic.primaryModelId) primaryId = aiSettings.basic.primaryModelId;
      if (aiSettings.basic.fallbackModel1Id) fallback11Id(aiSettings.basic.fallbackModel1Id);
      if (aiSettings.basic.fallbackModel2Id) fallback2Id = aiSettings.basic.fallbackModel2Id;
    }
  }

  function fallback11Id(id: string) {
    fallback1Id = id;
  }

  const modelIdSequence = Array.from(new Set([primaryId, fallback1Id, fallback2Id, "system-gemini-3.6"]));
  const customModelsMap = new Map<string, UserAIModelConfig>();
  if (aiSettings?.customModels) {
    aiSettings.customModels.forEach((m) => customModelsMap.set(m.id, m));
  }

  const attemptedModels: AIAttemptLog[] = [];
  const warnings: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < modelIdSequence.length; i++) {
    const mId = modelIdSequence[i];
    const config: UserAIModelConfig = customModelsMap.get(mId) || SYSTEM_MODELS_MAP[mId] || {
      id: mId,
      provider: mId.includes("gemini") ? "system_gemini" : "custom",
      name: mId,
      modelId: mId,
    };

    const isPrimary = i === 0;

    try {
      console.log(`[AI Executor] Attempting model [${i + 1}/${modelIdSequence.length}]: ${config.name} (${config.provider}:${config.modelId})`);

      const rawText = await callModelAPI(config, prompt, systemInstruction, responseSchema, taskCategory);

      if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
        throw new Error("Model returned empty or non-string response.");
      }

      // Robustly parse or repair JSON if schema or expected JSON format
      let parsedData: T;
      if (responseSchema || rawText.trim().startsWith("{") || rawText.trim().startsWith("[")) {
        try {
          parsedData = safeParseOrRepairJson<T>(rawText);
        } catch (jsonErr: any) {
          throw new Error(`Failed to parse structured JSON response: ${jsonErr.message}`);
        }
      } else {
        parsedData = rawText as unknown as T;
      }

      attemptedModels.push({
        modelId: config.modelId,
        modelName: config.name,
        provider: config.provider,
        success: true,
      });

      const latencyMs = Date.now() - startTime;
      const isFallbackUsed = !isPrimary;

      const meta: AIGenerationMetadata = {
        usedModelId: config.modelId,
        usedModelName: config.name,
        usedProvider: config.provider,
        isFallbackUsed,
        attemptedModels,
        hasWarnings: warnings.length > 0,
        warnings,
        latencyMs,
      };

      return { data: parsedData, meta };
    } catch (err: any) {
      const errMsg = err.message || "Unknown execution error";
      console.warn(`[AI Executor] Model "${config.name}" (${config.modelId}) failed:`, errMsg);

      attemptedModels.push({
        modelId: config.modelId,
        modelName: config.name,
        provider: config.provider,
        success: false,
        error: errMsg,
      });

      const failWarning = `Model "${config.name}" (${config.provider}:${config.modelId}) failed: ${errMsg}`;
      warnings.push(failWarning);
    }
  }

  // All models failed! Check fallback generator
  console.error("[AI Executor] All requested AI models failed! Using offline generator fallback if available.");
  if (fallbackGenerator) {
    const fallbackData = await fallbackGenerator();
    const meta: AIGenerationMetadata = {
      usedModelId: "offline-fallback",
      usedModelName: "Curated Engine (Offline Fallback)",
      usedProvider: "system_gemini",
      isFallbackUsed: true,
      attemptedModels,
      hasWarnings: true,
      warnings: [...warnings, "All configured AI models failed. Loaded curated fallback content."],
      latencyMs: Date.now() - startTime,
    };
    return { data: fallbackData, meta };
  }

  throw new Error(`All selected AI models failed. Warnings:\n${warnings.join("\n")}`);
}

async function callModelAPI(
  config: UserAIModelConfig,
  prompt: string,
  systemInstruction: string,
  responseSchema?: any,
  taskCategory?: AITaskCategory
): Promise<string> {
  const provider = config.provider;

  // 1. System Gemini API (via process.env.GEMINI_API_KEY)
  if (provider === "system_gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing on server.");
    }

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const model = config.modelId || "gemini-3.6-flash";

    const reqConfig: any = {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 32768,
    };

    if (responseSchema) {
      reqConfig.responseMimeType = "application/json";
      reqConfig.responseSchema = responseSchema;
    } else if (taskCategory === "itinerary" || prompt.includes("JSON") || systemInstruction.includes("JSON")) {
      reqConfig.responseMimeType = "application/json";
    }

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: reqConfig,
    });

    let rawText = res.text || "";
    if (!rawText && (res as any).candidates?.[0]?.content?.parts) {
      rawText = (res as any).candidates[0].content.parts
        .map((p: any) => p.text || "")
        .join("");
    }

    return rawText || "";
  }

  // 2. Custom Gemini with User API Key
  if (provider === "gemini") {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error(`API key required for Gemini model ${config.name}`);

    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const model = config.modelId || "gemini-3.6-flash";

    const reqConfig: any = {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 32768,
    };

    if (responseSchema) {
      reqConfig.responseMimeType = "application/json";
      reqConfig.responseSchema = responseSchema;
    } else if (taskCategory === "itinerary" || prompt.includes("JSON") || systemInstruction.includes("JSON")) {
      reqConfig.responseMimeType = "application/json";
    }

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: reqConfig,
    });

    let rawText = res.text || "";
    if (!rawText && (res as any).candidates?.[0]?.content?.parts) {
      rawText = (res as any).candidates[0].content.parts
        .map((p: any) => p.text || "")
        .join("");
    }

    return rawText || "";
  }

  // 3. OpenAI-Compatible API Providers (OpenAI, Groq, DeepSeek, OpenRouter, Ollama, LMStudio, HuggingFace, Custom)
  let endpoint = "";
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (provider) {
    case "openrouter":
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      if (!config.apiKey) throw new Error("OpenRouter API key is required.");
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      headers["HTTP-Referer"] = "https://localexplorer.ai";
      headers["X-Title"] = "LocalExplorer AI";
      break;

    case "groq":
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      if (!config.apiKey) throw new Error("Groq API key is required.");
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "deepseek":
      endpoint = "https://api.deepseek.com/v1/chat/completions";
      if (!config.apiKey) throw new Error("DeepSeek API key is required.");
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "openai":
      endpoint = "https://api.openai.com/v1/chat/completions";
      if (!config.apiKey) throw new Error("OpenAI API key is required.");
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "huggingface":
      endpoint = config.baseUrl
        ? `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`
        : "https://api-inference.huggingface.co/v1/chat/completions";
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "ollama":
      endpoint = config.baseUrl
        ? `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`
        : "http://localhost:11434/v1/chat/completions";
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "lmstudio":
      endpoint = config.baseUrl
        ? `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`
        : "http://localhost:1234/v1/chat/completions";
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;

    case "custom":
    default:
      if (!config.baseUrl) throw new Error("Base URL is required for custom endpoint.");
      endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
      if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;
      break;
  }

  const payload: any = {
    model: config.modelId,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 16384,
  };

  // Add response format if JSON expected and supported by provider
  if (responseSchema && ["openai", "groq", "deepseek", "openrouter", "ollama", "lmstudio"].includes(provider)) {
    payload.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} ${response.statusText}${errBody ? `: ${errBody.slice(0, 150)}` : ""}`);
    }

    const resJson = (await response.json()) as any;
    const content = resJson.choices?.[0]?.message?.content;
    if (!content) throw new Error("Provider response missing choices[0].message.content");

    return content;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error(`Request to ${provider} timed out after 60 seconds.`);
    }
    throw err;
  }
}
