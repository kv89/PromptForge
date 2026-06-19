import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/Badge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { useAddVersion, usePrompt, usePromoteVersion } from "@/hooks/usePrompts";
import type { PromptVariable } from "@/types/prompt";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

interface VariableMeta {
  description: string;
  example_value: string;
}

function detectVariables(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    names.add(match[1]);
  }
  return [...names];
}

export function PromptEditorPage() {
  const { promptId } = useParams<{ promptId: string }>();
  const navigate = useNavigate();

  const [content, setContent] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [varMeta, setVarMeta] = useState<Record<string, VariableMeta>>({});
  const [initialised, setInitialised] = useState(false);

  const promptQuery = usePrompt(promptId);
  const saveMutation = useAddVersion(promptId ?? "");
  const promoteMutation = usePromoteVersion(promptId ?? "");

  const prompt = promptQuery.data;
  const currentVersion = useMemo(() => {
    if (!prompt) return undefined;
    return (
      prompt.versions.find((v) => v.version_number === prompt.current_version) ??
      prompt.versions[prompt.versions.length - 1]
    );
  }, [prompt]);

  // Seed the editor once the prompt (and its current version) has loaded.
  useEffect(() => {
    if (!prompt || !currentVersion || initialised) return;
    setContent(currentVersion.content);
    const seeded: Record<string, VariableMeta> = {};
    for (const variable of currentVersion.variables) {
      seeded[variable.name] = {
        description: variable.description,
        example_value: variable.example_value,
      };
    }
    setVarMeta(seeded);
    setInitialised(true);
  }, [prompt, currentVersion, initialised]);

  const detectedVars = useMemo(() => detectVariables(content), [content]);

  const updateVarMeta = (
    name: string,
    field: keyof VariableMeta,
    value: string,
  ) => {
    setVarMeta((prev) => ({
      ...prev,
      [name]: {
        description: prev[name]?.description ?? "",
        example_value: prev[name]?.example_value ?? "",
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    const variables: PromptVariable[] = detectedVars.map((name) => ({
      name,
      description: varMeta[name]?.description ?? "",
      example_value: varMeta[name]?.example_value ?? "",
      required: true,
    }));
    saveMutation.mutate(
      {
        content,
        variables,
        change_note: changeNote.trim() || null,
        tags: [],
      },
      { onSuccess: () => navigate(`/prompts/${promptId}`) },
    );
  };

  if (promptQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (promptQuery.isError || !prompt) {
    return <ErrorBanner message="Could not load this prompt." />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{prompt.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <Badge label={prompt.status} />
            <span className="text-xs text-gray-400">
              editing from v{prompt.current_version}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => promoteMutation.mutate(prompt.current_version)}
          disabled={promoteMutation.isPending}
          className="rounded-md border border-brand-500 px-4 py-2 text-sm font-medium text-brand-500 hover:bg-brand-50 disabled:opacity-60"
        >
          {promoteMutation.isPending
            ? "Promoting…"
            : `Promote v${prompt.current_version} to stable`}
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Prompt content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[260px] w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder="Use {{variable}} placeholders to define injectable values."
        />
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Detected variables ({detectedVars.length})
        </h3>
        {detectedVars.length === 0 ? (
          <p className="text-sm text-gray-400">
            No variables detected. Add{" "}
            <code className="rounded bg-gray-100 px-1">{"{{name}}"}</code> in the
            content above.
          </p>
        ) : (
          <div className="space-y-3">
            {detectedVars.map((name) => (
              <div
                key={name}
                className="grid grid-cols-1 gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[160px_1fr_1fr]"
              >
                <div className="flex items-center font-mono text-sm text-brand-900">
                  {`{{${name}}}`}
                </div>
                <input
                  type="text"
                  value={varMeta[name]?.description ?? ""}
                  onChange={(e) =>
                    updateVarMeta(name, "description", e.target.value)
                  }
                  placeholder="Description"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={varMeta[name]?.example_value ?? ""}
                  onChange={(e) =>
                    updateVarMeta(name, "example_value", e.target.value)
                  }
                  placeholder="Example value"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Change note (optional)
        </label>
        <input
          type="text"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="What changed in this version?"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {saveMutation.isError ? (
        <ErrorBanner message="Failed to save new version. Please try again." />
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {saveMutation.isPending ? <Spinner className="h-4 w-4" /> : null}
          Save new version
        </button>
        <button
          type="button"
          onClick={() => navigate(`/prompts/${promptId}`)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
