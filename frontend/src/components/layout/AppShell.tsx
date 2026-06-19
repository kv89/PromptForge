import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

const NAV_LINKS = [
  { to: "/prompts", label: "Prompts", end: true },
  { to: "/prompts/new", label: "New Prompt", end: false },
  { to: "/rubrics", label: "Rubrics", end: true },
  { to: "/system/health", label: "System Health", end: false },
];

/** Maps the current pathname to a human-readable page title for the top bar. */
function usePageTitle(): string {
  const { pathname } = useLocation();
  if (pathname === "/prompts") return "Prompt Library";
  if (pathname === "/prompts/new") return "New Prompt";
  if (pathname === "/use-cases/new") return "New Use Case";
  if (pathname.endsWith("/edit")) return "Edit Prompt";
  if (pathname.startsWith("/prompts/")) return "Prompt Details";
  if (pathname === "/system/health") return "System Health";
  if (pathname === "/rubrics") return "Rubrics";
  if (pathname === "/rubrics/new") return "New Rubric";
  return "PromptForge";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const title = usePageTitle();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="px-6 py-5 text-xl font-bold text-brand-900">
          PromptForge
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-900"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {link.label}
            </NavLink>
            
          ))}
        </nav>

        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-3 px-1 py-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-8 w-8 rounded-full"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
                {initial}
              </div>
            )}
            <span className="flex-1 truncate text-xs text-gray-600">
              {user?.email ?? "Unknown"}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center border-b border-gray-200 bg-white px-6">
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
