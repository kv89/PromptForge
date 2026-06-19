import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const { isAuthenticated, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/prompts", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      navigate("/prompts", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign-in failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-900">PromptForge</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to manage your prompts
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          onClick={handleSignIn}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
