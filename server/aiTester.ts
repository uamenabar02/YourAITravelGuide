import { GoogleGenAI } from "@google/genai";

interface TestRequest {
  provider: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  isSystem?: boolean;
}

export async function testAIModelConnection(req: TestRequest): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();
  const provider = (req.provider || "").trim();
  const modelId = (req.modelId || "").trim();
  const apiKey = (req.apiKey || "").trim().replace(/^["']|["']$/g, '');
  const baseUrl = (req.baseUrl || "").trim();
  const isSystem = req.isSystem;

  try {
    if (provider === "system_gemini" || isSystem) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return {
          success: false,
          message: "System GEMINI_API_KEY environment variable is not set.",
        };
      }
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: modelId || "gemini-3.5-flash-lite",
        contents: "Respond with the single word: OK",
      });
      const latencyMs = Date.now() - startTime;
      if (response && response.text) {
        return {
          success: true,
          message: `System Gemini connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return { success: false, message: "Empty response from System Gemini." };
    }

    if (provider === "gemini") {
      if (!apiKey) {
        return { success: false, message: "Google Gemini API key is required." };
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: modelId || "gemini-2.5-flash",
        contents: "Respond with the single word: OK",
      });
      const latencyMs = Date.now() - startTime;
      if (response && response.text) {
        return {
          success: true,
          message: `Personal Gemini connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return { success: false, message: "Empty response from Gemini." };
    }

    if (provider === "openai") {
      if (!apiKey) {
        return { success: false, message: "OpenAI API key is required." };
      }
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId || "gpt-4o-mini",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message) {
        return {
          success: true,
          message: `OpenAI ChatGPT (${modelId}) connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `OpenAI error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "anthropic") {
      if (!apiKey) {
        return { success: false, message: "Anthropic API key is required." };
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId || "claude-3-5-haiku-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok && data.content?.[0]?.text) {
        return {
          success: true,
          message: `Anthropic Claude (${modelId}) connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `Anthropic error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "groq") {
      if (!apiKey) {
        return { success: false, message: "Groq API key is required." };
      }
      const targetModel = modelId || "llama-3.3-70b-versatile";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message) {
        return {
          success: true,
          message: `Groq (${targetModel}) connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }

      // Diagnostic check: Fetch models list available for this key
      try {
        const modelsRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (modelsRes.status === 401) {
          return {
            success: false,
            message: "Invalid Groq API key (401 Unauthorized). Please check your key at console.groq.com",
            latencyMs,
          };
        }
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          const availableIds: string[] = (modelsData.data || []).map((m: any) => m.id);
          if (availableIds.length > 0) {
            if (!availableIds.includes(targetModel)) {
              return {
                success: false,
                message: `Model '${targetModel}' is not enabled for your key/tier. Available models for your key: ${availableIds.slice(0, 5).join(", ")}`,
                latencyMs,
              };
            }
          }
        }
      } catch (_e) {
        // Fallback to standard error message
      }

      return {
        success: false,
        message: data.error?.message || `Groq error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "deepseek") {
      if (!apiKey) {
        return { success: false, message: "DeepSeek API key is required." };
      }
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId || "deepseek-chat",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message) {
        return {
          success: true,
          message: `DeepSeek (${modelId}) connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `DeepSeek error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "openrouter") {
      if (!apiKey) {
        return { success: false, message: "OpenRouter API key is required." };
      }
      const targetModel = modelId || "openai/gpt-4o-mini";
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://localexplorer.ai",
          "X-Title": "LocalExplorer AI",
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message) {
        return {
          success: true,
          message: `OpenRouter (${targetModel}) verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `OpenRouter error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "huggingface") {
      if (!apiKey) {
        return { success: false, message: "Hugging Face User Access Token is required." };
      }
      const targetModel = modelId || "meta-llama/Llama-3.2-3B-Instruct";
      const url = baseUrl
        ? baseUrl.replace(/\/$/, "") + "/chat/completions"
        : "https://api-inference.huggingface.co/v1/chat/completions";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          message: `Hugging Face (${targetModel}) verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || data.error || `Hugging Face error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    if (provider === "ollama") {
      const hostUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "http://localhost:11434/v1";
      const url = `${hostUrl}/chat/completions`;
      const targetModel = modelId || "llama3.2";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          message: `Ollama local model (${targetModel}) connected! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `Ollama connection error: HTTP ${res.status}. Is Ollama running at ${hostUrl}?`,
        latencyMs,
      };
    }

    if (provider === "lmstudio") {
      const hostUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "http://localhost:1234/v1";
      const url = `${hostUrl}/chat/completions`;
      const targetModel = modelId || "local-model";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          message: `LM Studio local server connected! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `LM Studio error: HTTP ${res.status}. Is local LM Studio server active at ${hostUrl}?`,
        latencyMs,
      };
    }

    if (provider === "custom") {
      const url = baseUrl ? baseUrl.replace(/\/$/, "") + "/chat/completions" : "";
      if (!url) {
        return { success: false, message: "Base URL is required for custom endpoints." };
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelId || "custom",
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      if (res.ok) {
        return {
          success: true,
          message: `Custom Endpoint connection verified! (${latencyMs}ms)`,
          latencyMs,
        };
      }
      return {
        success: false,
        message: data.error?.message || `Custom API error: HTTP ${res.status}`,
        latencyMs,
      };
    }

    return { success: false, message: `Unsupported AI provider '${provider}'` };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to connect to API.",
      latencyMs: Date.now() - startTime,
    };
  }
}

export async function fetchAvailableModelsForProvider(req: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<{ success: boolean; models: Array<{ id: string; name?: string }>; message?: string }> {
  const provider = (req.provider || "").trim();
  const apiKey = (req.apiKey || "").trim().replace(/^["']|["']$/g, '');
  const baseUrl = (req.baseUrl || "").trim();

  try {
    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!res.ok) {
        return { success: false, models: [], message: `OpenRouter error: HTTP ${res.status}` };
      }
      const data = await res.json();
      const models = (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name ? `${m.name} (${m.id})` : m.id,
      }));
      return { success: true, models };
    }

    if (provider === "groq") {
      if (!apiKey) return { success: false, models: [], message: "API Key is required to fetch Groq models." };
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        return { success: false, models: [], message: `Groq error: HTTP ${res.status}` };
      }
      const data = await res.json();
      const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
      return { success: true, models };
    }

    if (provider === "openai") {
      if (!apiKey) return { success: false, models: [], message: "API Key is required to fetch OpenAI models." };
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { success: false, models: [], message: `OpenAI error: HTTP ${res.status}` };
      const data = await res.json();
      const models = (data.data || [])
        .filter((m: any) => m.id.startsWith("gpt") || m.id.startsWith("o1") || m.id.startsWith("o3"))
        .map((m: any) => ({ id: m.id, name: m.id }));
      return { success: true, models };
    }

    if (provider === "huggingface") {
      const res = await fetch(
        "https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=50",
        { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} }
      );
      if (!res.ok) return { success: false, models: [], message: `Hugging Face error: HTTP ${res.status}` };
      const data = await res.json();
      const models = (Array.isArray(data) ? data : []).map((m: any) => ({
        id: m.id,
        name: `${m.id} (${m.downloads ? m.downloads.toLocaleString() + ' downloads' : 'HF'})`,
      }));
      return { success: true, models };
    }

    if (provider === "ollama") {
      const hostUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "http://localhost:11434/v1";
      const res = await fetch(`${hostUrl}/models`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
        return { success: true, models };
      }
      // Try /api/tags (Ollama native API)
      const tagsRes = await fetch(`${hostUrl.replace(/\/v1$/, "")}/api/tags`);
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        const models = (data.models || []).map((m: any) => ({ id: m.name, name: m.name }));
        return { success: true, models };
      }
      return { success: false, models: [], message: `Could not reach Ollama at ${hostUrl}` };
    }

    if (provider === "lmstudio") {
      const hostUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "http://localhost:1234/v1";
      const res = await fetch(`${hostUrl}/models`);
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
        return { success: true, models };
      }
      return { success: false, models: [], message: `Could not reach LM Studio at ${hostUrl}` };
    }

    if (provider === "custom" || baseUrl) {
      const hostUrl = baseUrl ? baseUrl.replace(/\/$/, "") : "";
      if (!hostUrl) return { success: false, models: [], message: "Base URL is required." };
      const target = hostUrl.endsWith("/v1") ? `${hostUrl}/models` : `${hostUrl}/v1/models`;
      const headers: Record<string, string> = {};
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(target, { headers });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => ({ id: m.id, name: m.id }));
        return { success: true, models };
      }
      return { success: false, models: [], message: `Custom endpoint error HTTP ${res.status}` };
    }

    return { success: false, models: [], message: `Automatic model listing not supported for ${provider}` };
  } catch (err: any) {
    return { success: false, models: [], message: err.message || "Failed to fetch model list." };
  }
}
