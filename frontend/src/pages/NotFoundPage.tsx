import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-brand-50">
      <p className="text-6xl font-bold text-brand-900">404</p>
      <p className="text-gray-600">This page could not be found.</p>
      <Link
        to="/prompts"
        className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
      >
        Back to Prompts
      </Link>
    </div>
  );
}
