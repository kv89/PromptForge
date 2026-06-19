import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Spinner } from "@/components/ui/Spinner";
import { useCreatePrompt, useUseCaseList } from "@/hooks/usePrompts";

const CREATE_USE_CASE_OPTION = "__create__";

interface FieldErrors {
  name?: string;
  content?: string;
  useCase?: string;
}

export function NewPromptPage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [useCaseId, setUseCaseId] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const useCasesQuery = useUseCaseList();

  const mutation = useCreatePrompt();

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (name.trim().length < 3) {
      next.name = "Name must be at least 3 characters.";
    }
    if (content.trim().length < 10) {
      next.content = "Prompt content must be at least 10 characters.";
    }
    if (!useCaseId) {
      next.useCase = "Please select a use case.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        use_case_id: useCaseId,
        initial_content: content,
        variables: [],
        tags: [],
      },
      {
        onSuccess: (prompt) => navigate(`/prompts/${prompt.id}`),
      },
    );
  };

  const handleUseCaseChange = (value: string) => {
    if (value === CREATE_USE_CASE_OPTION) {
      navigate("/use-cases/new", { state: { returnTo: "/prompts/new" } });
      return;
    }
    setUseCaseId(value);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Create a new prompt</h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Invoice line-item extractor"
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-red-600">{errors.name}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="What does this prompt do?"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Use Case
        </label>
        <select
          value={useCaseId}
          onChange={(e) => handleUseCaseChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Select a use case…</option>
          {useCasesQuery.data?.map((uc) => (
            <option key={uc.id} value={uc.id}>
              {uc.icon ? `${uc.icon} ` : ""}
              {uc.name}
            </option>
          ))}
          <option value={CREATE_USE_CASE_OPTION}>+ Create new use case</option>
        </select>
        {errors.useCase ? (
          <p className="mt-1 text-xs text-red-600">{errors.useCase}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Initial prompt content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[200px] w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
          placeholder="Write your prompt here. Use {{variable}} for injectable values."
        />
        {errors.content ? (
          <p className="mt-1 text-xs text-red-600">{errors.content}</p>
        ) : null}
      </div>

      {mutation.isError ? (
        <ErrorBanner message="Failed to create prompt. Please try again." />
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
          Create prompt
        </button>
        <button
          type="button"
          onClick={() => navigate("/prompts")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
