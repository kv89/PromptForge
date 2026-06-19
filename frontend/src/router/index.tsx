import { createBrowserRouter, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { NewPromptPage } from "@/pages/NewPromptPage";
import { NewUseCasePage } from "@/pages/NewUseCasePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PromptDetailPage } from "@/pages/PromptDetailPage";
import { PromptEditorPage } from "@/pages/PromptEditorPage";
import { PromptsListPage } from "@/pages/PromptsListPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
import { RubricsListPage } from "@/pages/RubricsListPage";
import { RubricBuilderPage } from "@/pages/RubricBuilderPage";
import { PromptComparisonPage } from "@/pages/PromptComparisonPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: <Navigate to="/prompts" replace /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/prompts", element: <PromptsListPage /> },
      { path: "/prompts/new", element: <NewPromptPage /> },
      { path: "/prompts/:promptId", element: <PromptDetailPage /> },
      { path: "/prompts/:promptId/edit", element: <PromptEditorPage /> },
      { path: "/use-cases/new", element: <NewUseCasePage /> },
      { path: "/system/health", element: <SystemHealthPage /> },
      { path: "/rubrics", element: <RubricsListPage /> },
      { path: "/rubrics/new", element: <RubricBuilderPage /> },
      { path: "/prompts/:promptId/compare", element: <PromptComparisonPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
