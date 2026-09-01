import { AIProvider, UserAIModelConfig, AISelectionSettings, AITaskCategory } from "../types";
import { authedFetch } from "./apiClient";

export const SYSTEM_MODELS: UserAIModelConfig[] = [
  {
    id: "system-gemini-3.6",
    provider: "system_gemini",
    name: "Gemini 3.6 Flash (Default)",
    modelId: "gemini-3.6-flash",
    status: "working",
    isSystem: true,
  },
  {
    id: "system-gemini-3.5",
    provider: "system_gemini",
    name: "Gemini 3.5 Flash-Lite (Speed)",
    modelId: "gemini-3.5-flash-lite",
    status: "working",
    isSystem: true,
  },
  {
    id: "system-gemini-2.5-pro",
    provider: "system_gemini",
    name: "Gemini 2.5 Pro (Deep Reasoning)",
    modelId: "gemini-2.5-pro",
    status: "working",
    isSystem: true,
  },
];

export const PROVIDER_PRESETS: Array<{
  provider: AIProvider;
  label: string;
  icon: string;
  defaultModels: string[];
  placeholderKey: string;
  docsUrl?: string;
}> = [
  {
    provider: "openai",
    label: "OpenAI (ChatGPT)",
    icon: "🟢",
    defaultModels: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    placeholderKey: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    provider: "anthropic",
    label: "Anthropic (Claude)",
    icon: "🟧",
    defaultModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-haiku-20240307"],
    placeholderKey: "sk-ant-api...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    provider: "groq",
    label: "Groq Llama / Mixtral",
    icon: "⚡",
    defaultModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
      "gemma2-9b-it",
      "deepseek-r1-distill-llama-70b"
    ],
    placeholderKey: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    provider: "deepseek",
    label: "DeepSeek AI",
    icon: "🐋",
    defaultModels: ["deepseek-chat", "deepseek-coder"],
    placeholderKey: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    provider: "gemini",
    label: "Google Gemini (Personal Key)",
    icon: "✨",
    defaultModels: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
    placeholderKey: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    provider: "openrouter",
    label: "OpenRouter (Unified API)",
    icon: "🌐",
    defaultModels: [
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-r1",
      "mistralai/mistral-large-2411"
    ],
    placeholderKey: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    provider: "huggingface",
    label: "Hugging Face (Inference API)",
    icon: "🤗",
    defaultModels: [
      "meta-llama/Llama-3.2-3B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
      "Qwen/Qwen2.5-72B-Instruct",
      "google/gemma-2-9b-it"
    ],
    placeholderKey: "hf_...",
    docsUrl: "https://huggingface.co/settings/tokens",
  },
  {
    provider: "ollama",
    label: "Ollama (Local Running Model)",
    icon: "🦙",
    defaultModels: ["llama3.2", "llama3.3", "mistral", "gemma2", "deepseek-r1:8b", "phi4"],
    placeholderKey: "Optional (not required for local Ollama)",
    docsUrl: "https://ollama.com",
  },
  {
    provider: "lmstudio",
    label: "LM Studio (Local Running Model)",
    icon: "💻",
    defaultModels: ["local-model"],
    placeholderKey: "Optional (not required for LM Studio)",
    docsUrl: "https://lmstudio.ai",
  },
  {
    provider: "custom",
    label: "Custom OpenAI-Compatible Endpoint",
    icon: "⚙️",
    defaultModels: ["custom-model-1"],
    placeholderKey: "api-key-if-required",
  },
];

const LOCAL_STORAGE_KEY = "localexplorer_ai_selection_settings";

export function getDefaultAISettings(): AISelectionSettings {
  return {
    mode: "basic",
    basic: {
      primaryModelId: "system-gemini-3.6",
      fallbackModel1Id: "system-gemini-3.5",
      fallbackModel2Id: "system-gemini-2.5-pro",
    },
    advanced: {
      itinerary: {
        primaryModelId: "system-gemini-3.6",
        fallbackModel1Id: "system-gemini-3.5",
        fallbackModel2Id: "system-gemini-2.5-pro",
      },
      activity_details: {
        primaryModelId: "system-gemini-3.6",
        fallbackModel1Id: "system-gemini-3.5",
        fallbackModel2Id: "system-gemini-2.5-pro",
      },
      spot_swap: {
        primaryModelId: "system-gemini-3.6",
        fallbackModel1Id: "system-gemini-3.5",
        fallbackModel2Id: "system-gemini-2.5-pro",
      },
      advisor: {
        primaryModelId: "system-gemini-3.6",
        fallbackModel1Id: "system-gemini-3.5",
        fallbackModel2Id: "system-gemini-2.5-pro",
      },
    },
    customModels: [],
  };
}

export function loadAISettings(): AISelectionSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return getDefaultAISettings();
    const parsed = JSON.parse(raw);
    return {
      mode: parsed.mode || "basic",
      basic: {
        primaryModelId: parsed.basic?.primaryModelId || "system-gemini-3.6",
        fallbackModel1Id: parsed.basic?.fallbackModel1Id || "system-gemini-3.5",
        fallbackModel2Id: parsed.basic?.fallbackModel2Id || "system-gemini-2.5-pro",
      },
      advanced: {
        itinerary: {
          primaryModelId: parsed.advanced?.itinerary?.primaryModelId || "system-gemini-3.6",
          fallbackModel1Id: parsed.advanced?.itinerary?.fallbackModel1Id || "system-gemini-3.5",
          fallbackModel2Id: parsed.advanced?.itinerary?.fallbackModel2Id || "system-gemini-2.5-pro",
        },
        activity_details: {
          primaryModelId: parsed.advanced?.activity_details?.primaryModelId || "system-gemini-3.6",
          fallbackModel1Id: parsed.advanced?.activity_details?.fallbackModel1Id || "system-gemini-3.5",
          fallbackModel2Id: parsed.advanced?.activity_details?.fallbackModel2Id || "system-gemini-2.5-pro",
        },
        spot_swap: {
          primaryModelId: parsed.advanced?.spot_swap?.primaryModelId || "system-gemini-3.6",
          fallbackModel1Id: parsed.advanced?.spot_swap?.fallbackModel1Id || "system-gemini-3.5",
          fallbackModel2Id: parsed.advanced?.spot_swap?.fallbackModel2Id || "system-gemini-2.5-pro",
        },
        advisor: {
          primaryModelId: parsed.advanced?.advisor?.primaryModelId || "system-gemini-3.6",
          fallbackModel1Id: parsed.advanced?.advisor?.fallbackModel1Id || "system-gemini-3.5",
          fallbackModel2Id: parsed.advanced?.advisor?.fallbackModel2Id || "system-gemini-2.5-pro",
        },
      },
      customModels: Array.isArray(parsed.customModels) ? parsed.customModels : [],
    };
  } catch (err) {
    console.error("Error loading AI settings from localStorage:", err);
    return getDefaultAISettings();
  }
}

export function saveAISettings(settings: AISelectionSettings): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error("Error saving AI settings to localStorage:", err);
  }
}

export function getAllAvailableModels(settings: AISelectionSettings): UserAIModelConfig[] {
  return [...SYSTEM_MODELS, ...(settings.customModels || [])];
}

export async function testAIModelConnection(modelConfig: UserAIModelConfig): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();
  try {
    const response = await authedFetch("/api/ai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        apiKey: modelConfig.apiKey || "",
        baseUrl: modelConfig.baseUrl || "",
        isSystem: modelConfig.isSystem || false,
      }),
    });

    const latencyMs = Date.now() - startTime;
    const data = await response.json();

    if (response.ok && data.success) {
      return {
        success: true,
        message: data.message || `Connection verified! (${latencyMs}ms)`,
        latencyMs,
      };
    } else {
      return {
        success: false,
        message: data.error || data.message || "Failed to connect to model API.",
        latencyMs,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Network error while testing connection.",
      latencyMs: Date.now() - startTime,
    };
  }
}
