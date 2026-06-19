import { useState, useEffect } from "react";
import { useImprovePrompt, useAddVersion } from "@/hooks/usePrompts";
import { useToast } from "@/components/ui/Toast";
import type { EvalResult, Prompt } from "@/types/prompt";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt;
  evalResult: EvalResult;
  selectedImprovements: string[];
}

function DiffInline({ original, improved }: { original: string; improved: string }) {
  const oLines = original.split("\n");
  const iLines = improved.split("\n");
  const maxLen = Math.max(oLines.length, iLines.length);

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden text-xs font-mono">
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        <div className="bg-red-50 px-2 py-1 text-red-600 font-semibold text-xs">
          Original
        </div>
        <div className="bg-green-50 px-2 py-1 text-green-600 font-semibold text-xs">
          Improved
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-200 max-h-64 overflow-y-auto">
        <pre className="p-2 text-gray-700 whitespace-pre-wrap">
          {Array.from({ length: maxLen }, (_, i) => {
            const line = oLines[i] ?? "";
            const changed = line !== (iLines[i] ?? "");
            return (
              <div
                key={i}
                className={changed && line ? "bg-red-50 text-red-700" : ""}
              >
                {line || " "}
              </div>
            );
          })}
        </pre>
        <pre className="p-2 text-gray-700 whitespace-pre-wrap">
          {Array.from({ length: maxLen }, (_, i) => {
            const line = iLines[i] ?? "";
            const changed = line !== (oLines[i] ?? "");
            return (
              <div
                key={i}
                className={changed && line ? "bg-green-50 text-green-700" : ""}
              >
                {line || " "}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export function ImprovementDrawer({
  isOpen,
  onClose,
  prompt,
  evalResult,
  selectedImprovements,
}: Props) {
  const improvePrompt = useImprovePrompt();
  const addVersion = useAddVersion(prompt.id!);
  const { showSuccess } = useToast();

  const [mode, setMode] = useState<"surgical" | "holistic">("surgical");
  const [rewrittenPrompt, setRewrittenPrompt] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      setRewrittenPrompt("");
      setHasGenerated(false);
      setChangeNote(
        `Applied improvements: ${selectedImprovements.slice(0, 2).join("; ")}${
          selectedImprovements.length > 2 ? "…" : ""
        }`
      );
    }
  }, [isOpen]);

  const currentVersion = prompt.versions.find(
    (v) => v.version_number === evalResult.version_number
  );

  const handleGenerate = () => {
    improvePrompt.mutate(
      {
        promptId: prompt.id!,
        data: {
          prompt_id: prompt.id!,
          version_number: evalResult.version_number,
          selected_improvements: selectedImprovements,
          mode,
        },
      },
      {
        onSuccess: (res) => {
          setRewrittenPrompt(res.rewritten_prompt);
          setHasGenerated(true);
        },
      }
    );
  };

  const handleSave = () => {
    addVersion.mutate(
      {
        content: rewrittenPrompt,
        variables: currentVersion?.variables ?? [],
        change_note: changeNote || "AI-assisted improvement",
        tags: ["ai-improved"],
      },
      {
        onSuccess: () => {
          showSuccess(
            "New version saved. Open the Run Panel to evaluate it."
          );
          onClose();
        },
      }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Improve Prompt</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              v{evalResult.version_number} · {selectedImprovements.length} improvement
              {selectedImprovements.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Selected improvements */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Selected improvements
            </p>
            <ul className="space-y-2">
              {selectedImprovements.map((imp, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-gray-700">{imp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mode toggle */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Rewrite mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["surgical", "holistic"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    mode === m
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m === "surgical" ? "🔬 Surgical" : "✍️ Holistic"}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {mode === "surgical"
                ? "Only changes parts related to selected improvements. Safer."
                : "Rewrites the full prompt for better overall quality. May restructure."}
            </p>
          </div>

          {/* Generate button */}
          {!hasGenerated && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={improvePrompt.isPending}
              className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {improvePrompt.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Generating improved prompt…
                </>
              ) : (
                "✨ Generate improved prompt"
              )}
            </button>
          )}

          {/* Result */}
          {hasGenerated && rewrittenPrompt && (
            <>
              {/* Diff */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Diff vs original
                </p>
                <DiffInline
                  original={currentVersion?.content ?? ""}
                  improved={rewrittenPrompt}
                />
              </div>

              {/* Editable result */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Improved prompt — edit before saving
                </p>
                <textarea
                  value={rewrittenPrompt}
                  onChange={(e) => setRewrittenPrompt(e.target.value)}
                  rows={10}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Change note */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Change note
                </label>
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Regenerate */}
              <button
                type="button"
                onClick={() => {
                  setHasGenerated(false);
                  setRewrittenPrompt("");
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                ↺ Regenerate with different mode
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        {hasGenerated && rewrittenPrompt && (
          <div className="border-t border-gray-200 px-5 py-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={addVersion.isPending}
              className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {addVersion.isPending ? "Saving…" : "Save as new version"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}