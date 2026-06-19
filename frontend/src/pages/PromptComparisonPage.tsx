import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePrompt } from "@/hooks/usePrompts";
import { usePromptEvals } from "@/hooks/useEvals";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Badge } from "@/components/ui/Badge";
import type { PromptVersion, EvalResult } from "@/types/prompt";

// ── Simple line diff ──────────────────────────────────────────────────────────

function diffLines(a: string, b: string) {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const maxLen = Math.max(aLines.length, bLines.length);
  const result = [];
  for (let i = 0; i < maxLen; i++) {
    const aLine = aLines[i] ?? "";
    const bLine = bLines[i] ?? "";
    result.push({
      lineNum: i + 1,
      a: aLine,
      b: bLine,
      changed: aLine !== bLine,
      addedInB: aLine === "" && bLine !== "",
      removedInB: aLine !== "" && bLine === "",
    });
  }
  return result;
}

// ── Score comparison card ─────────────────────────────────────────────────────

interface ScoreCompareProps {
  evalA: EvalResult | null;
  evalB: EvalResult | null;
  labelA: string;
  labelB: string;
}

function ScoreCompare({ evalA, evalB, labelA, labelB }: ScoreCompareProps) {
  if (!evalA && !evalB) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
        No eval scores available for these versions. Run each version first.
      </div>
    );
  }

  const criteria = evalA?.criterion_scores ?? evalB?.criterion_scores ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Score Comparison</h3>

      {/* Overall scores */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: labelA, eval: evalA },
          { label: labelB, eval: evalB },
        ].map(({ label, eval: e }) => (
          <div
            key={label}
            className="rounded-md bg-gray-50 border border-gray-200 p-3 text-center"
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            {e ? (
              <>
                <p
                  className={`text-2xl font-bold ${
                    e.overall_score >= 75
                      ? "text-green-600"
                      : e.overall_score >= 50
                      ? "text-amber-600"
                      : "text-red-600"
                  }`}
                >
                  {e.overall_score}
                  <span className="text-sm font-normal text-gray-400">/100</span>
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    e.passed
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {e.passed ? "✓ Passed" : "✗ Failed"}
                </span>
              </>
            ) : (
              <p className="text-sm text-gray-400">No score</p>
            )}
          </div>
        ))}
      </div>

      {/* Per-criterion comparison */}
      {criteria.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Criterion breakdown
          </p>
          {criteria.map((c) => {
            const scoreA =
              evalA?.criterion_scores.find((x) => x.name === c.name)?.score ?? null;
            const scoreB =
              evalB?.criterion_scores.find((x) => x.name === c.name)?.score ?? null;
            const delta =
              scoreA != null && scoreB != null ? scoreB - scoreA : null;
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{c.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-12 text-right">
                      {scoreA != null ? `${scoreA}/10` : "—"}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-500 w-12">
                      {scoreB != null ? `${scoreB}/10` : "—"}
                    </span>
                    {delta != null && (
                      <span
                        className={`text-xs font-medium w-12 text-right ${
                          delta > 0
                            ? "text-green-600"
                            : delta < 0
                            ? "text-red-600"
                            : "text-gray-400"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta === 0 ? "=" : delta}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[scoreA, scoreB].map((score, i) => (
                    <div key={i} className="h-1.5 rounded-full bg-gray-200">
                      {score != null && (
                        <div
                          className={`h-1.5 rounded-full ${
                            score >= 7
                              ? "bg-green-500"
                              : score >= 5
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${(score / 10) * 100}%` }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Diff view ─────────────────────────────────────────────────────────────────

interface DiffViewProps {
  versionA: PromptVersion;
  versionB: PromptVersion;
}

function DiffView({ versionA, versionB }: DiffViewProps) {
  const lines = diffLines(versionA.content, versionB.content);
  const changedCount = lines.filter((l) => l.changed).length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <p className="text-sm font-semibold text-gray-700">Content Diff</p>
        <span className="text-xs text-gray-400">
          {changedCount} line{changedCount !== 1 ? "s" : ""} changed
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* Version A */}
        <div>
          <div className="px-3 py-1.5 bg-red-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-red-600">
              v{versionA.version_number}
              {versionA.is_stable ? " ✓ stable" : ""}
            </p>
          </div>
          <pre className="p-3 font-mono text-xs text-gray-700 overflow-x-auto max-h-96 overflow-y-auto">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.changed && line.a
                    ? "bg-red-50 text-red-700"
                    : ""
                } px-1 leading-5`}
              >
                <span className="select-none text-gray-300 mr-3 w-6 inline-block text-right">
                  {line.a ? line.lineNum : ""}
                </span>
                {line.a || " "}
              </div>
            ))}
          </pre>
        </div>

        {/* Version B */}
        <div>
          <div className="px-3 py-1.5 bg-green-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-green-600">
              v{versionB.version_number}
              {versionB.is_stable ? " ✓ stable" : ""}
            </p>
          </div>
          <pre className="p-3 font-mono text-xs text-gray-700 overflow-x-auto max-h-96 overflow-y-auto">
            {lines.map((line, i) => (
              <div
                key={i}
                className={`${
                  line.changed && line.b
                    ? "bg-green-50 text-green-700"
                    : ""
                } px-1 leading-5`}
              >
                <span className="select-none text-gray-300 mr-3 w-6 inline-block text-right">
                  {line.b ? line.lineNum : ""}
                </span>
                {line.b || " "}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PromptComparisonPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const promptQuery = usePrompt(promptId);
  const evalsQuery = usePromptEvals(promptId);

  const [versionANum, setVersionANum] = useState<number | null>(null);
  const [versionBNum, setVersionBNum] = useState<number | null>(null);

  if (promptQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (promptQuery.isError || !promptQuery.data) {
    return <ErrorBanner message="Could not load prompt." />;
  }

  const prompt = promptQuery.data;
  const versions = [...prompt.versions].sort(
    (a, b) => a.version_number - b.version_number,
  );

  if (versions.length < 2) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-gray-500 text-sm">
          This prompt needs at least 2 versions to compare.
        </p>
        <Link
          to={`/prompts/${promptId}/edit`}
          className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          Add a version
        </Link>
      </div>
    );
  }

  // Default: compare last two versions
  const defaultA = versions[versions.length - 2].version_number;
  const defaultB = versions[versions.length - 1].version_number;
  const selectedA = versionANum ?? defaultA;
  const selectedB = versionBNum ?? defaultB;

  const versionA = versions.find((v) => v.version_number === selectedA);
  const versionB = versions.find((v) => v.version_number === selectedB);

  // Find best eval for each version (highest score)
  const evals = evalsQuery.data ?? [];
  const evalForVersion = (vNum: number): EvalResult | null => {
    const matching = evals
      .filter((e) => e.version_number === vNum)
      .sort((a, b) => b.overall_score - a.overall_score);
    return matching[0] ?? null;
  };

  const evalA = evalForVersion(selectedA);
  const evalB = evalForVersion(selectedB);

  return (
    <div className="mx-auto max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={`/prompts/${promptId}`}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← {prompt.name}
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            Version Comparison
          </h2>
        </div>
        <Badge label={prompt.use_case_name} variant="blue" />
      </div>

      {/* Version selectors */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Compare from", value: selectedA, setter: setVersionANum },
          { label: "Compare to", value: selectedB, setter: setVersionBNum },
        ].map(({ label, value, setter }) => (
          <div key={label}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {label}
            </label>
            <select
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {versions.map((v) => (
                <option key={v.version_number} value={v.version_number}>
                  v{v.version_number}
                  {v.is_stable ? " ✓ stable" : ""}
                  {v.change_note ? ` — ${v.change_note}` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Score comparison */}
      <ScoreCompare
        evalA={evalA}
        evalB={evalB}
        labelA={`v${selectedA}`}
        labelB={`v${selectedB}`}
      />

      {/* Diff */}
      {versionA && versionB && (
        <DiffView versionA={versionA} versionB={versionB} />
      )}

      {/* Variable changes */}
      {versionA && versionB && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Variable Changes
          </h3>
          {versionA.variables.length === 0 && versionB.variables.length === 0 ? (
            <p className="text-sm text-gray-400">No variables in either version.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {[
                { version: versionA, label: `v${selectedA}` },
                { version: versionB, label: `v${selectedB}` },
              ].map(({ version, label }) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-gray-500 mb-2">
                    {label}
                  </p>
                  {version.variables.length === 0 ? (
                    <p className="text-xs text-gray-400">No variables</p>
                  ) : (
                    <div className="space-y-1">
                      {version.variables.map((v) => (
                        <div
                          key={v.name}
                          className="text-xs bg-gray-50 rounded px-2 py-1"
                        >
                          <span className="font-mono text-brand-500">
                            {`{{${v.name}}}`}
                          </span>
                          {v.description && (
                            <span className="text-gray-500 ml-2">
                              {v.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}