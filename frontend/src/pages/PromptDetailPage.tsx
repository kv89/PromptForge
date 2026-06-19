import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { RunPanel } from "@/components/run/RunPanel";
import { RunResultCard } from "@/components/run/RunResultCard";
import { RunHistoryTable } from "@/components/run/RunHistoryTable";
import { StabilityCard } from "@/components/eval/StabilityCard";
import { usePrompt, usePromoteVersion } from "@/hooks/usePrompts";
import { useManualEval } from "@/hooks/useEvals";
import { useStabilityTest } from "@/hooks/useRuns";
import { formatDateTime } from "@/lib/format";
import type {
  EvalResult,
  PromptVersion,
  Run,
  StabilityResult,
} from "@/types/prompt";

// cast helper so TypeScript doesn't complain about the polled result shape
function toStabilityResult(r: unknown): StabilityResult {
  return r as StabilityResult;
}

// ── Stability variable inputs ─────────────────────────────────────────────────

interface StabilityVarsProps {
  variables: PromptVersion["variables"];
}

function StabilityVarInputs({ variables }: StabilityVarsProps) {
  if (variables.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Fill variables — same values will be used across all 5 runs
      </p>
      {variables.map((v) => (
        <div key={v.name}>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {v.description || v.name}
            {v.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            placeholder={v.example_value || `Enter ${v.name}`}
            id={`stability-var-${v.name}`}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromptDetailPage() {
  const { promptId } = useParams<{ promptId: string }>();

  // ── ALL hooks first ──
  const promptQuery = usePrompt(promptId);
  const promoteVersion = usePromoteVersion(promptId!);
  const manualEval = useManualEval();
  const stabilityTest = useStabilityTest();

  const [showRunPanel, setShowRunPanel] = useState(false);
  const [showStabilityPanel, setShowStabilityPanel] = useState(false);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [lastEval, setLastEval] = useState<EvalResult | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(null);

  // ── Early returns after all hooks ──
  if (promptQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (promptQuery.isError || !promptQuery.data) {
    return <ErrorBanner message="Could not load this prompt." />;
  }

  // ── Derived values ──
  const prompt = promptQuery.data;
  const activeVersionNumber = selectedVersionNumber ?? prompt.current_version;

  const currentVersion: PromptVersion | undefined =
    prompt.versions.find((v) => v.version_number === activeVersionNumber) ??
    prompt.versions[prompt.versions.length - 1];

  const sortedVersions = [...prompt.versions].sort(
    (a, b) => b.version_number - a.version_number,
  );

  const stabilityVars = currentVersion?.variables ?? [];

  const handleRunStability = () => {
    const variables: Record<string, string> = {};
    stabilityVars.forEach((v) => {
      const el = document.getElementById(
        `stability-var-${v.name}`,
      ) as HTMLInputElement | null;
      if (el) variables[v.name] = el.value;
      console.log(`Stability var ${v.name}:`, el?.value, 'el found:', !!el);
    });
    console.log('Sending variables:', variables);
    stabilityTest.mutate({
      promptId: prompt.id!,
      params: { version_number: activeVersionNumber, variables, n: 3 },
    });
  };

  // ── Render ──
  return (
    <div className="mx-auto max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">{prompt.name}</h2>
          <p className="text-gray-600">{prompt.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={prompt.use_case_name} variant="blue" />
            <Badge label={prompt.status} />
            <span className="text-xs text-gray-400">
              v{prompt.current_version}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/prompts/${prompt.id}/edit`}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Edit / New Version
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowRunPanel((v) => !v);
              if (showRunPanel) setLastRun(null);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              showRunPanel
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {showRunPanel ? "Close Run Panel" : "▶ Run Prompt"}
          </button>
          <button
            type="button"
            onClick={() => setShowStabilityPanel((v) => !v)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              showStabilityPanel
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-purple-600 text-white hover:bg-purple-700"
            }`}
          >
            {showStabilityPanel ? "Close Stability" : "⚡ Stability Test"}
          </button>
          <Link
              to={`/prompts/${prompt.id}/compare`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              ⇄ Compare versions
            </Link>
        </div>
      </div>

      {/* Run Panel */}
      {showRunPanel && (
        <RunPanel
          prompt={prompt}
          selectedVersionNumber={activeVersionNumber}
          onRunComplete={(run) => {
            setLastRun(run);
            if ((run as any).eval_result) {
              setLastEval((run as any).eval_result);
            }
          }}
        />
      )}

      {/* Last Run Result */}
      {lastRun && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Last Run Result
          </h3>
          <RunResultCard
            run={lastRun}
            evalResult={lastEval}
            prompt={prompt}
            onEvaluate={() =>
              manualEval.mutate(
                { runId: lastRun.id },
                { onSuccess: (e) => setLastEval(e) },
              )
            }
            isEvaluating={manualEval.isPending}
          />
        </div>
      )}

      {/* Stability Panel */}
      {showStabilityPanel && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">
            Stability Test — runs the prompt 5 times and measures score variance
          </h4>

          <StabilityVarInputs variables={stabilityVars} />

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              Version: v{activeVersionNumber}
            </span>
            <button
              type="button"
              onClick={handleRunStability}
              disabled={stabilityTest.isPending}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {stabilityTest.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  {stabilityTest.progress != null
                    ? `Run ${stabilityTest.progress}/${stabilityTest.total ?? 3}…`
                    : "Starting…"}
                </>
              ) : (
                "▶ Run stability test"
              )}
            </button>
          </div>

          {stabilityTest.result && (
            <StabilityCard result={toStabilityResult(stabilityTest.result)} />
          )}
        </div>
      )}

      {/* Current version content */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {selectedVersionNumber
            ? `Version ${selectedVersionNumber} content`
            : "Current version content"}
        </h3>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-900 p-4 font-mono text-sm text-gray-100">
          {currentVersion?.content ?? "(empty)"}
        </pre>
      </section>

      {/* Version history */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Version history
        </h3>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {sortedVersions.map((version) => (
            <li
              key={version.version_number}
              onClick={() => setSelectedVersionNumber(version.version_number)}
              className={`flex items-center justify-between gap-4 px-4 py-3 cursor-pointer transition-colors ${
                version.version_number === activeVersionNumber
                  ? "bg-brand-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">
                    v{version.version_number}
                  </span>
                  {version.is_stable && (
                    <Badge label="stable" variant="green" />
                  )}
                </div>
                <p className="truncate text-sm text-gray-500">
                  {version.change_note || "No change note"}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <span className="text-xs text-gray-400">
                  {formatDateTime(version.created_at)}
                </span>
                {!version.is_stable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      promoteVersion.mutate(version.version_number);
                    }}
                    disabled={promoteVersion.isPending}
                    className="rounded-md border border-brand-500 px-3 py-1 text-xs font-medium text-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {promoteVersion.isPending ? "Promoting…" : "Promote to stable"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Run history */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Run history
        </h3>
        <RunHistoryTable promptId={prompt.id!} />
      </section>

    </div>
  );
}