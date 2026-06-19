import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Spinner } from "@/components/ui/Spinner";
import { useCreateUseCase } from "@/hooks/usePrompts";

interface LocationState {
  returnTo?: string;
}

export function NewUseCasePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo =
    (location.state as LocationState | null)?.returnTo ?? "/prompts/new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const mutation = useCreateUseCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError(null);
    mutation.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
      },
      { onSuccess: () => navigate(returnTo) },
    );
  };

  const conflict =
    mutation.isError &&
    // axios error with 409 means the derived slug already exists
    (mutation.error as { response?: { status?: number } })?.response?.status ===
      409;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-5">
      <h2 className="text-2xl font-bold text-gray-900">Create a use case</h2>
      <p className="text-sm text-gray-500">
        Use cases group related prompts (e.g. "Invoice Parser", "SQL
        Generator"). They are shared across the whole platform.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Invoice Parser"
        />
        {nameError ? (
          <p className="mt-1 text-xs text-red-600">{nameError}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Icon (optional)
        </label>
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={4}
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-center text-lg"
          placeholder="🧾"
        />
        <p className="mt-1 text-xs text-gray-400">
          Paste an emoji or type a short symbol.
        </p>
      </div>

      {mutation.isError ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {conflict
            ? "A use case with this name already exists."
            : "Failed to create use case. Please try again."}
        </div>
      ) : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {mutation.isPending ? <Spinner className="h-4 w-4" /> : null}
          Create use case
        </button>
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
