import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useExecuteRun } from "@/hooks/useRuns";
import { getOllamaHealth } from "@/services/healthService";
import type { Prompt, PromptVersion, Run } from "@/types/prompt";

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(content: string): string[] {
  const matches = [...content.matchAll(VARIABLE_REGEX)];
  return [...new Set(matches.map((m) => m[1]))];
}

interface Props {
  prompt: Prompt;
  selectedVersionNumber: number;
  onRunComplete: (run: Run) => void;
}

export function RunPanel({ prompt, selectedVersionNumber, onRunComplete }: Props) {
  const executeRun = useExecuteRun();

  const [versionNumber, setVersionNumber] = useState(selectedVersionNumber);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch model info dynamically from Ollama health endpoint
  const modelQuery = useQuery({
    queryKey: ["ollama-health"],
    queryFn: getOllamaHealth,
    staleTime: 60000, // cache for 1 minute
  });

  const modelDisplay = useMemo(() => {
    const provider = import.meta.env.VITE_MODEL_PROVIDER ?? "ollama";
    if (provider === "vertexai") {
      const model = import.meta.env.VITE_VERTEXAI_DEFAULT_MODEL ?? "models/gemini-2.5-flash";
      return `${model} — via Gemini`;
    }
    if (modelQuery.data?.status === "ok" && modelQuery.data.models?.length) {
      return `${modelQuery.data.models[0]} — via Ollama`;
    }
    return "mistral:7b — via Ollama";
  }, [modelQuery.data]);

  const selectedVersion: PromptVersion | undefined = useMemo(
    () => prompt.versions.find((v) => v.version_number === versionNumber),
    [prompt.versions, versionNumber]
  );

  const detectedVars: string[] = useMemo(
    () => (selectedVersion ? extractVariables(selectedVersion.content) : []),
    [selectedVersion]
  );

  const getVarMeta = (name: string) =>
    selectedVersion?.variables.find((v) => v.name === name);

  const handleVariableChange = (name: string, value: string) => {
    setVariables((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const e = { ...prev };
        delete e[name];
        return e;
      });
    }
  };

  const handleRun = () => {
    // Validate required variables
    const newErrors: Record<string, string> = {};
    detectedVars.forEach((name) => {
      const meta = getVarMeta(name);
      const isRequired = meta ? meta.required : true;
      if (isRequired && !variables[name]?.trim()) {
        newErrors[name] = "This variable is required";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    executeRun.mutate(
      {
        prompt_id: prompt.id!,
        version_number: versionNumber,
        variables,
        temperature,
        max_tokens: maxTokens,
      },
      {
        onSuccess: (run) => onRunComplete(run),
      }
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-5">

      {/* Section 1 — Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700">Configuration</h4>

        {/* Version selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Version
          </label>
          <select
            value={versionNumber}
            onChange={(e) => setVersionNumber(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {[...prompt.versions]
              .sort((a, b) => b.version_number - a.version_number)
              .map((v) => (
                <option key={v.version_number} value={v.version_number}>
                  v{v.version_number}
                  {v.is_stable ? " ✓ stable" : ""}
                  {v.change_note ? ` — ${v.change_note}` : ""}
                </option>
              ))}
          </select>
        </div>

        {/* Temperature */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Temperature
            <span className="ml-2 font-mono text-brand-500">{temperature}</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0.0 — precise</span>
            <span>1.0 — creative</span>
          </div>
        </div>

        {/* Max tokens */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Max tokens
          </label>
          <input
            type="number"
            min={256}
            max={8192}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Model display — dynamic from Ollama health */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Model
          </label>
          <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
            {modelDisplay}
          </div>
        </div>
      </div>

      {/* Section 2 — Variables */}
      {detectedVars.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">Variables</h4>
          {detectedVars.map((name) => {
            const meta = getVarMeta(name);
            const isRequired = meta ? meta.required : true;
            return (
              <div key={name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {meta?.description || name}
                  {isRequired && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder={meta?.example_value || `Enter ${name}`}
                  value={variables[name] ?? ""}
                  onChange={(e) => handleVariableChange(name, e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors[name]
                      ? "border-red-400 bg-red-50"
                      : "border-gray-300 bg-white"
                  }`}
                />
                {errors[name] && (
                  <p className="mt-1 text-xs text-red-500">{errors[name]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section 3 — Run button */}
      <button
        type="button"
        onClick={handleRun}
        disabled={executeRun.isPending}
        className="w-full rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {executeRun.isPending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Running…
          </>
        ) : (
          "▶ Run Prompt"
        )}
      </button>
    </div>
  );
}