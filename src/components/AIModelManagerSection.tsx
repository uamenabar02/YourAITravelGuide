import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Eye,
  EyeOff,
  Key,
  Globe,
  HelpCircle,
  Check,
  ChevronDown,
  Layers,
  Compass,
  MapPin,
  MessageSquare,
  BookOpen,
  Cpu,
} from "lucide-react";
import {
  AIProvider,
  UserAIModelConfig,
  AISelectionSettings,
  AITaskCategory,
} from "../types";
import {
  PROVIDER_PRESETS,
  SYSTEM_MODELS,
  loadAISettings,
  saveAISettings,
  getAllAvailableModels,
  testAIModelConnection,
} from "../utils/aiConfig";
import { TranslatedText } from "./TranslatedText";
import { authedFetch } from "../utils/apiClient";

interface AIModelManagerSectionProps {
  onSettingsChanged?: () => void;
}

export const AIModelManagerSection: React.FC<AIModelManagerSectionProps> = ({
  onSettingsChanged,
}) => {
  const [settings, setSettings] = useState<AISelectionSettings>(loadAISettings);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; message: string; latencyMs?: number }>
  >({});

  // Add / Edit Model Modal Form state
  const formRef = useRef<HTMLFormElement>(null);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [addProvider, setAddProvider] = useState<AIProvider>("openai");
  const [addName, setAddName] = useState("");
  const [addModelId, setAddModelId] = useState("gpt-4o");
  const [addApiKey, setAddApiKey] = useState("");
  const [addBaseUrl, setAddBaseUrl] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [addTestResult, setAddTestResult] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
  }>({ testing: false });

  // Dynamic model detection state
  const [fetchedModelsList, setFetchedModelsList] = useState<Array<{ id: string; name?: string }>>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsMsg, setFetchModelsMsg] = useState<string | null>(null);

  // Save notification toast
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Sync default model name & default base URL when provider changes
  useEffect(() => {
    if (!editingModelId && isAddFormOpen) {
      const preset = PROVIDER_PRESETS.find((p) => p.provider === addProvider);
      if (preset && preset.defaultModels.length > 0) {
        setAddModelId(preset.defaultModels[0]);
        if (!addName || PROVIDER_PRESETS.some((p) => p.label.includes(addName))) {
          setAddName(`${preset.label.split(" ")[0]} (${preset.defaultModels[0]})`);
        }
      }
      if (addProvider === "ollama" && !addBaseUrl) {
        setAddBaseUrl("http://localhost:11434/v1");
      } else if (addProvider === "lmstudio" && !addBaseUrl) {
        setAddBaseUrl("http://localhost:1234/v1");
      }
      setFetchedModelsList([]);
      setFetchModelsMsg(null);
    }
  }, [addProvider, editingModelId, isAddFormOpen]);

  const resetForm = () => {
    setIsAddFormOpen(false);
    setEditingModelId(null);
    setConfirmDeleteId(null);
    setAddApiKey("");
    setAddBaseUrl("");
    setAddName("");
    setAddProvider("openai");
    setAddModelId("gpt-4o");
    setAddTestResult({ testing: false });
    setFetchedModelsList([]);
    setIsFetchingModels(false);
    setFetchModelsMsg(null);
  };

  const handleFetchAvailableModels = async () => {
    setIsFetchingModels(true);
    setFetchModelsMsg(null);
    try {
      const res = await authedFetch("/api/ai/fetch-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: addProvider,
          apiKey: addApiKey,
          baseUrl: addBaseUrl,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setFetchedModelsList(data.models);
        setFetchModelsMsg(`Detected ${data.models.length} model(s) available for your API key / server!`);
      } else {
        setFetchedModelsList([]);
        setFetchModelsMsg(data.message || "No models returned from provider API.");
      }
    } catch (err: any) {
      setFetchedModelsList([]);
      setFetchModelsMsg(err.message || "Failed to fetch model list.");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleOpenAddForm = () => {
    resetForm();
    setIsAddFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleOpenEditForm = (model: UserAIModelConfig) => {
    setEditingModelId(model.id);
    setAddProvider(model.provider);
    setAddName(model.name);
    setAddModelId(model.modelId);
    setAddApiKey(model.apiKey || "");
    setAddBaseUrl(model.baseUrl || "");
    setAddTestResult({ testing: false });
    setIsAddFormOpen(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const handleSaveSettings = (newSettings: AISelectionSettings) => {
    setSettings(newSettings);
    saveAISettings(newSettings);
    setFeedbackMsg("AI Model preferences saved!");
    setTimeout(() => setFeedbackMsg(null), 3500);
    if (onSettingsChanged) onSettingsChanged();
  };

  const handleTestExistingModel = async (modelConfig: UserAIModelConfig) => {
    setTestingModelId(modelConfig.id);
    const result = await testAIModelConnection(modelConfig);
    setTestResults((prev) => ({
      ...prev,
      [modelConfig.id]: result,
    }));
    setTestingModelId(null);
  };

  const handleTestNewModelForm = async () => {
    setAddTestResult({ testing: true });
    const tempConfig: UserAIModelConfig = {
      id: editingModelId || "temp-test",
      provider: addProvider,
      name: addName || "Test Model",
      modelId: addModelId,
      apiKey: addApiKey,
      baseUrl: addBaseUrl,
    };
    const result = await testAIModelConnection(tempConfig);
    setAddTestResult({
      testing: false,
      success: result.success,
      message: result.message,
    });
  };

  const handleSaveModelForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addModelId.trim()) return;

    const preset = PROVIDER_PRESETS.find((p) => p.provider === addProvider);

    if (editingModelId) {
      // Update existing model
      const updatedCustoms = settings.customModels.map((m) =>
        m.id === editingModelId
          ? {
              ...m,
              provider: addProvider,
              name: addName.trim() || `${preset?.label || addProvider} (${addModelId})`,
              modelId: addModelId.trim(),
              apiKey: addApiKey.trim(),
              baseUrl: addBaseUrl.trim(),
              status: addTestResult.success ? ("working" as const) : m.status,
              lastTestedAt: Date.now(),
            }
          : m
      );

      const newSettings: AISelectionSettings = {
        ...settings,
        customModels: updatedCustoms,
      };

      handleSaveSettings(newSettings);
    } else {
      // Add new model
      const newModel: UserAIModelConfig = {
        id: `custom-${Date.now()}`,
        provider: addProvider,
        name: addName.trim() || `${preset?.label || addProvider} (${addModelId})`,
        modelId: addModelId.trim(),
        apiKey: addApiKey.trim(),
        baseUrl: addBaseUrl.trim(),
        status: addTestResult.success ? "working" : "untested",
        lastTestedAt: Date.now(),
      };

      const updatedCustoms = [...settings.customModels, newModel];
      const newSettings: AISelectionSettings = {
        ...settings,
        customModels: updatedCustoms,
      };

      handleSaveSettings(newSettings);
    }

    resetForm();
  };

  const executeDeleteModel = (modelId: string) => {
    const updatedCustoms = settings.customModels.filter((m) => m.id !== modelId);

    // Reset basic selectors if deleted model was selected
    let { primaryModelId, fallbackModel1Id, fallbackModel2Id } = settings.basic;
    if (primaryModelId === modelId) primaryModelId = "system-gemini-3.6";
    if (fallbackModel1Id === modelId) fallbackModel1Id = "system-gemini-3.5";
    if (fallbackModel2Id === modelId) fallbackModel2Id = "system-gemini-2.5-pro";

    const newSettings: AISelectionSettings = {
      ...settings,
      basic: { primaryModelId, fallbackModel1Id, fallbackModel2Id },
      customModels: updatedCustoms,
    };

    handleSaveSettings(newSettings);
    if (editingModelId === modelId) {
      resetForm();
    }
    setConfirmDeleteId(null);
  };

  const availableModels = getAllAvailableModels(settings);

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <TranslatedText text={feedbackMsg} />
          </span>
        </div>
      )}

      {/* 1. Header & Registered Models Section */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-stone-900 text-base font-serif">
                <TranslatedText text="AI Models & Personal API Keys" />
              </h4>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              <TranslatedText text="Use built-in system models or connect your own personal AI memberships (ChatGPT, Claude, Groq, DeepSeek, Gemini, etc.)." />
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddForm}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <TranslatedText text="Add Personal AI Key / Model" />
          </button>
        </div>

        {/* Add / Edit Model Form Container */}
        {isAddFormOpen && (
          <form
            ref={formRef}
            onSubmit={handleSaveModelForm}
            className="bg-stone-50 p-4 rounded-xl border border-emerald-400 ring-2 ring-emerald-500/20 space-y-4 animate-fade-in"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h5 className="font-bold text-xs uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                {editingModelId ? (
                  <>
                    <Pencil className="w-3.5 h-3.5 text-emerald-700" />
                    <TranslatedText text="Edit Personal AI Membership" />
                  </>
                ) : (
                  <>
                    <Key className="w-3.5 h-3.5 text-emerald-700" />
                    <TranslatedText text="Configure Personal AI Membership" />
                  </>
                )}
              </h5>
              <button
                type="button"
                onClick={resetForm}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold px-2 py-0.5 rounded-md hover:bg-stone-200"
              >
                ✕
              </button>
            </div>

            {/* Provider Select & Base URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  <TranslatedText text="AI Provider" />
                </label>
                <select
                  value={addProvider}
                  onChange={(e) => setAddProvider(e.target.value as AIProvider)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.provider} value={p.provider}>
                      {p.icon} {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    <TranslatedText text="Model ID / Version" />
                  </label>
                  <button
                    type="button"
                    onClick={handleFetchAvailableModels}
                    disabled={isFetchingModels}
                    className="text-[10px] text-emerald-800 hover:text-emerald-900 font-bold bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Fetch models available for your API key / server"
                  >
                    {isFetchingModels ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-emerald-700" />
                        <span>Detecting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-emerald-700" />
                        <span>Detect Models for Key</span>
                      </>
                    )}
                  </button>
                </div>

                {fetchedModelsList.length > 0 ? (
                  <select
                    value={addModelId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setAddModelId(selId);
                      const selObj = fetchedModelsList.find((m) => m.id === selId);
                      const presetLabel = PROVIDER_PRESETS.find((p) => p.provider === addProvider)?.label.split(" ")[0] || addProvider;
                      setAddName(`${presetLabel} (${selObj?.name || selId})`);
                    }}
                    className="w-full px-3 py-2 bg-emerald-50 border border-emerald-400 rounded-xl text-xs text-emerald-950 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono cursor-pointer mb-1"
                  >
                    {fetchedModelsList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={addModelId}
                    onChange={(e) => setAddModelId(e.target.value)}
                    placeholder="e.g. gpt-4o, openrouter/free, llama3.2"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
                    required
                  />
                )}
              </div>
            </div>

            {/* Notification message after model detection */}
            {fetchModelsMsg && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 font-medium flex items-center justify-between">
                <span>{fetchModelsMsg}</span>
                {fetchedModelsList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFetchedModelsList([]);
                      setFetchModelsMsg(null);
                    }}
                    className="text-stone-400 hover:text-stone-700 text-[10px] font-bold underline cursor-pointer"
                  >
                    Manual text input
                  </button>
                )}
              </div>
            )}

            {/* Base URL Input for Custom, Ollama, LM Studio, or HuggingFace */}
            {(addProvider === "custom" || addProvider === "ollama" || addProvider === "lmstudio" || addProvider === "huggingface") && (
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  <TranslatedText text="Endpoint Base URL" />
                  {addProvider === "ollama" && " (Default: http://localhost:11434/v1)"}
                  {addProvider === "lmstudio" && " (Default: http://localhost:1234/v1)"}
                </label>
                <input
                  type="text"
                  value={addBaseUrl}
                  onChange={(e) => setAddBaseUrl(e.target.value)}
                  placeholder={
                    addProvider === "ollama"
                      ? "http://localhost:11434/v1"
                      : addProvider === "lmstudio"
                      ? "http://localhost:1234/v1"
                      : "https://api.mycustomai.com/v1"
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
                />
              </div>
            )}

            {/* Local Models Helper Card for Ollama / LM Studio */}
            {(addProvider === "ollama" || addProvider === "lmstudio") && (
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-950">
                  <Cpu className="w-3.5 h-3.5 text-amber-700" />
                  <span>Running Local AI Models</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Make sure your local server is running (e.g. <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">ollama serve</code> or LM Studio local server) with CORS allowed for web requests. Click <strong>"Detect Models for Key"</strong> to auto-discover models installed on your machine!
                </p>
              </div>
            )}

            {/* Display Name & API Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  <TranslatedText text="Display Label (Nickname)" />
                </label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. My OpenRouter Tier / Ollama Llama 3.2"
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">
                    <TranslatedText text="Personal API Key" />
                  </label>
                  {PROVIDER_PRESETS.find((p) => p.provider === addProvider)?.docsUrl && (
                    <a
                      href={PROVIDER_PRESETS.find((p) => p.provider === addProvider)?.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold"
                    >
                      <span>Get API Key</span>
                      <Globe className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={addApiKey}
                    onChange={(e) => setAddApiKey(e.target.value)}
                    placeholder={
                      PROVIDER_PRESETS.find((p) => p.provider === addProvider)?.placeholderKey ||
                      "sk-..."
                    }
                    className="w-full pl-3 pr-8 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Connection Status Banner */}
            {addTestResult.message && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  addTestResult.success
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    : "bg-red-100 text-red-900 border border-red-300"
                }`}
              >
                {addTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                )}
                <span>{addTestResult.message}</span>
              </div>
            )}

            {/* Form Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-stone-600 hover:text-stone-900 text-xs font-semibold"
              >
                <TranslatedText text="Cancel" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestNewModelForm}
                  disabled={addTestResult.testing}
                  className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${addTestResult.testing ? "animate-spin text-emerald-700" : ""}`}
                  />
                  <span>{addTestResult.testing ? "Testing..." : "Test Connection"}</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {editingModelId ? (
                    <TranslatedText text="Update Model" />
                  ) : (
                    <TranslatedText text="Save Personal Model" />
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Registered Models List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
              <TranslatedText text="Available AI Models Catalog" />
            </label>
            <span className="text-[11px] text-stone-500">
              {settings.customModels.length} Personal Key(s) • {SYSTEM_MODELS.length} System Models
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableModels.map((model) => {
              const testRes = testResults[model.id];
              const isTesting = testingModelId === model.id;
              const preset = PROVIDER_PRESETS.find((p) => p.provider === model.provider);

              return (
                <div
                  key={model.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 shadow-2xs ${
                    model.isSystem
                      ? "border-stone-200 bg-stone-50/70"
                      : "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-base">{preset?.icon || "✨"}</span>
                        <span className="font-bold text-xs text-stone-900 truncate">
                          {model.name}
                        </span>
                        {model.isSystem ? (
                          <span className="px-1.5 py-0.5 bg-stone-200 text-stone-700 font-extrabold text-[9px] rounded-md uppercase tracking-wider">
                            System
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[9px] rounded-md uppercase tracking-wider">
                            Personal Key
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono mt-1 truncate">
                        Model: <span className="text-stone-700 font-semibold">{model.modelId}</span>
                        {model.apiKey ? ` • Key: ***${model.apiKey.slice(-4)}` : ""}
                      </div>

                      {/* Test result status badge */}
                      {testRes && (
                        <div className="mt-1 flex items-center gap-1 text-[10px]">
                          {testRes.success ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Verified ({testRes.latencyMs}ms)</span>
                            </span>
                          ) : (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              <span className="truncate max-w-[180px]">{testRes.message}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTestExistingModel(model)}
                        disabled={isTesting}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                          isTesting
                            ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                            : "bg-white hover:bg-stone-100 text-stone-700 border-stone-200"
                        }`}
                        title="Test connection"
                      >
                        <RefreshCw className={`w-3 h-3 ${isTesting ? "animate-spin text-emerald-700" : ""}`} />
                        <span>{isTesting ? "..." : "Test"}</span>
                      </button>

                      {/* Explicit EDIT & DELETE buttons for user personal models */}
                      {!model.isSystem && (
                        <>
                          {confirmDeleteId === model.id ? (
                            <div className="flex items-center gap-1 bg-red-100 p-1 rounded-lg border border-red-300 animate-fade-in">
                              <span className="text-[10px] text-red-900 font-extrabold px-1">Delete?</span>
                              <button
                                type="button"
                                onClick={() => executeDeleteModel(model.id)}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-0.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded text-[10px] font-bold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditForm(model)}
                                className="px-2 py-1 text-stone-700 hover:text-emerald-800 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer border border-stone-200 bg-white text-[11px] font-bold flex items-center gap-1"
                                title="Edit personal AI model & key"
                              >
                                <Pencil className="w-3 h-3 text-emerald-700" />
                                <TranslatedText text="Edit" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(model.id)}
                                className="px-2 py-1 text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-stone-200 bg-white text-[11px] font-bold flex items-center gap-1"
                                title="Delete personal AI model"
                              >
                                <Trash2 className="w-3 h-3 text-red-600" />
                                <TranslatedText text="Delete" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Model Selector Tool (Basic vs Advanced) */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-700" />
              <h4 className="font-bold text-stone-900 text-base font-serif">
                <TranslatedText text="AI Content Generation Routing Tool" />
              </h4>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              <TranslatedText text="Select primary and fallback AI models for itinerary planning, activity guides, and recommendations." />
            </p>
          </div>

          {/* Mode Selector Toggle Switch */}
          <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 border border-stone-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleSaveSettings({ ...settings, mode: "basic" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                settings.mode === "basic"
                  ? "bg-white text-emerald-800 shadow-xs font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <TranslatedText text="Basic Selector" />
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings({ ...settings, mode: "advanced" })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                settings.mode === "advanced"
                  ? "bg-white text-emerald-800 shadow-xs font-extrabold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <TranslatedText text="Advanced Selector" />
            </button>
          </div>
        </div>

        {/* --- BASIC SELECTOR VIEW --- */}
        {settings.mode === "basic" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2">
              <Zap className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Basic Selector Active: </span>
                <TranslatedText text="Choose 3 models (Primary + 2 Fallbacks) that will be used globally across all AI generated itineraries, guides, and spot recommendations." />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Primary Model */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">
                    1
                  </span>
                  <TranslatedText text="Primary Model (Default)" />
                </div>
                <select
                  value={settings.basic.primaryModelId}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      basic: { ...settings.basic, primaryModelId: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.modelId})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 italic">
                  <TranslatedText text="First choice for all AI requests." />
                </p>
              </div>

              {/* Fallback 1 */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[11px]">
                    2
                  </span>
                  <TranslatedText text="Fallback Model 1" />
                </div>
                <select
                  value={settings.basic.fallbackModel1Id}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      basic: { ...settings.basic, fallbackModel1Id: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.modelId})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 italic">
                  <TranslatedText text="Used automatically if Primary hits rate limits." />
                </p>
              </div>

              {/* Fallback 2 */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-stone-900">
                  <span className="w-5 h-5 rounded-full bg-stone-600 text-white flex items-center justify-center text-[11px]">
                    3
                  </span>
                  <TranslatedText text="Fallback Model 2" />
                </div>
                <select
                  value={settings.basic.fallbackModel2Id}
                  onChange={(e) =>
                    handleSaveSettings({
                      ...settings,
                      basic: { ...settings.basic, fallbackModel2Id: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.modelId})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-stone-500 italic">
                  <TranslatedText text="Backup model for high reliability." />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- ADVANCED SELECTOR VIEW --- */}
        {settings.mode === "advanced" && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2">
              <Layers className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Advanced Selector Active: </span>
                <TranslatedText text="Configure distinct AI models and fallbacks for each specific task category. For instance, use Claude or GPT-4o for full itineraries, and Gemini Flash for fast activity details!" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  key: "itinerary" as AITaskCategory,
                  title: "Full Itinerary Generation",
                  icon: Compass,
                  desc: "Multi-day vacation & hometown travel plan creation",
                },
                {
                  key: "activity_details" as AITaskCategory,
                  title: "Details & Local Guide Chat",
                  icon: BookOpen,
                  desc: "Deep activity guides, historical context & AI agent chat",
                },
                {
                  key: "spot_swap" as AITaskCategory,
                  title: "Spot Swap & Swiper Suggestions",
                  icon: RefreshCw,
                  desc: "Personalized alternative spot recommendations",
                },
                {
                  key: "advisor" as AITaskCategory,
                  title: "Travel Advisor & Packing",
                  icon: MessageSquare,
                  desc: "Packing checklists, local customs & destination advice",
                },
              ].map((task) => {
                const TaskIcon = task.icon;
                const taskConfig = settings.advanced[task.key];

                return (
                  <div
                    key={task.key}
                    className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
                      <TaskIcon className="w-4 h-4 text-emerald-700" />
                      <div>
                        <h5 className="font-bold text-xs text-stone-900 font-serif">
                          <TranslatedText text={task.title} />
                        </h5>
                        <p className="text-[10px] text-stone-500">{task.desc}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Primary */}
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                          <TranslatedText text="Primary Model" />
                        </label>
                        <select
                          value={taskConfig.primaryModelId}
                          onChange={(e) =>
                            handleSaveSettings({
                              ...settings,
                              advanced: {
                                ...settings.advanced,
                                [task.key]: {
                                  ...taskConfig,
                                  primaryModelId: e.target.value,
                                },
                              },
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        >
                          {availableModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Fallback 1 & 2 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-medium text-stone-600 mb-0.5">
                            <TranslatedText text="Fallback 1" />
                          </label>
                          <select
                            value={taskConfig.fallbackModel1Id}
                            onChange={(e) =>
                              handleSaveSettings({
                                ...settings,
                                advanced: {
                                  ...settings.advanced,
                                  [task.key]: {
                                    ...taskConfig,
                                    fallbackModel1Id: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-[11px] text-stone-800"
                          >
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-medium text-stone-600 mb-0.5">
                            <TranslatedText text="Fallback 2" />
                          </label>
                          <select
                            value={taskConfig.fallbackModel2Id}
                            onChange={(e) =>
                              handleSaveSettings({
                                ...settings,
                                advanced: {
                                  ...settings.advanced,
                                  [task.key]: {
                                    ...taskConfig,
                                    fallbackModel2Id: e.target.value,
                                  },
                                },
                              })
                            }
                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-[11px] text-stone-800"
                          >
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
