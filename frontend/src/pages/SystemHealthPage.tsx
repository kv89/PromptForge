import { useQuery } from "@tanstack/react-query";
import {
  getApiHealth,
  getFirestoreHealth,
  getOllamaHealth,
} from "@/services/healthService";
import { formatDateTime } from "@/lib/format";

function StatusDot({ status }: { status: "ok" | "error" | "loading" }) {
  const color =
    status === "ok"
      ? "bg-green-500"
      : status === "error"
      ? "bg-red-500"
      : "bg-amber-400";
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${color} ${
        status === "loading" ? "animate-pulse" : ""
      }`}
    />
  );
}

interface HealthCardProps {
  title: string;
  status: "ok" | "error" | "loading";
  lastChecked: Date | null;
  children: React.ReactNode;
}

function HealthCard({ title, status, lastChecked, children }: HealthCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>
        {lastChecked && (
          <span className="text-xs text-gray-400">
            checked {formatDateTime(lastChecked.toISOString())}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function SystemHealthPage() {

  const apiQuery = useQuery({
    queryKey: ["health-api"],
    queryFn: getApiHealth,
    refetchInterval: 30000,
  });

  const firestoreQuery = useQuery({
    queryKey: ["health-firestore"],
    queryFn: getFirestoreHealth,
    refetchInterval: 30000,
  });

  const ollamaQuery = useQuery({
    queryKey: ["health-ollama"],
    queryFn: getOllamaHealth,
    refetchInterval: 30000,
  });

  const refetchAll = () => {
    apiQuery.refetch();
    firestoreQuery.refetch();
    ollamaQuery.refetch();
  };

  const getStatus = (query: typeof apiQuery) => {
    if (query.isLoading) return "loading";
    if (query.isError) return "error";
    return query.data?.status === "ok" ? "ok" : "error";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
          <p className="text-gray-500 text-sm mt-1">
            All services refresh every 30 seconds
          </p>
        </div>
        <button
          type="button"
          onClick={refetchAll}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Backend API */}
      <HealthCard
        title="Backend API"
        status={getStatus(apiQuery)}
        lastChecked={apiQuery.dataUpdatedAt ? new Date(apiQuery.dataUpdatedAt) : null}
      >
        {apiQuery.isLoading && (
          <p className="text-sm text-gray-400">Checking...</p>
        )}
        {apiQuery.data && (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 w-24">Status</span>
              <span
                className={
                  apiQuery.data.status === "ok"
                    ? "text-green-600 font-medium"
                    : "text-red-600 font-medium"
                }
              >
                {apiQuery.data.status}
              </span>
            </div>
            {apiQuery.data.version && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Version</span>
                <span className="text-gray-700">{apiQuery.data.version}</span>
              </div>
            )}
            {apiQuery.data.environment && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-24">Environment</span>
                <span className="text-gray-700">{apiQuery.data.environment}</span>
              </div>
            )}
          </div>
        )}
        {apiQuery.isError && (
          <p className="text-sm text-red-600">
            Cannot reach backend at localhost:8000
          </p>
        )}
      </HealthCard>

      {/* Firestore */}
      <HealthCard
        title="Firestore"
        status={getStatus(firestoreQuery)}
        lastChecked={
          firestoreQuery.dataUpdatedAt
            ? new Date(firestoreQuery.dataUpdatedAt)
            : null
        }
      >
        {firestoreQuery.isLoading && (
          <p className="text-sm text-gray-400">Checking...</p>
        )}
        {firestoreQuery.data?.status === "ok" && (
          <p className="text-sm text-green-600 font-medium">
            Connected — database: promptforge
          </p>
        )}
        {firestoreQuery.data?.status === "error" && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700 font-medium">Connection failed</p>
            <p className="text-sm text-red-600 mt-1">
              {firestoreQuery.data.detail}
            </p>
          </div>
        )}
      </HealthCard>

      {/* Ollama */}
      <HealthCard
        title="Ollama (Model Server)"
        status={getStatus(ollamaQuery)}
        lastChecked={
          ollamaQuery.dataUpdatedAt
            ? new Date(ollamaQuery.dataUpdatedAt)
            : null
        }
      >
        {ollamaQuery.isLoading && (
          <p className="text-sm text-gray-400">Checking...</p>
        )}
        {ollamaQuery.data?.status === "ok" && (
          <div className="space-y-2">
            <p className="text-sm text-green-600 font-medium">
              Running on localhost:11434
            </p>
            <div>
              <p className="text-xs text-gray-500 mb-1">Installed models</p>
              <div className="flex flex-wrap gap-2">
                {ollamaQuery.data.models?.map((m) => (
                  <span
                    key={m}
                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-mono"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {ollamaQuery.data?.status === "error" && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-2">
            <p className="text-sm text-amber-700 font-medium">
              ⚠️ Ollama is not running
            </p>
            <p className="text-sm text-amber-600">
              Prompt execution will fail until Ollama is started.
            </p>
            <div className="bg-white rounded border border-amber-200 p-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">
                To start Ollama:
              </p>
              <code className="text-xs text-gray-700 block">
                docker start ollama
              </code>
              <p className="text-xs font-semibold text-gray-600 mt-2 mb-1">
                To pull the model:
              </p>
              <code className="text-xs text-gray-700 block">
                docker exec ollama ollama pull mistral:7b
              </code>
            </div>
          </div>
        )}
      </HealthCard>

      
      {/* Active provider */}
      <HealthCard
        title="Model Configuration"
        status="ok"
        lastChecked={null}
      >
        <div className="space-y-1 text-sm">
          <div className="flex gap-2">
            <span className="text-gray-500 w-32">Executor</span>
            <span className="font-mono text-gray-700">
              {import.meta.env.VITE_MODEL_PROVIDER ?? "ollama"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-500 w-32">Judge</span>
            <span className="font-mono text-gray-700">
              {import.meta.env.VITE_JUDGE_PROVIDER ?? "ollama"}
            </span>
          </div>
        </div>
      </HealthCard>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Backend API", query: apiQuery },
          { label: "Firestore", query: firestoreQuery },
          { label: "Ollama", query: ollamaQuery },
        ].map(({ label, query }) => (
          <div
            key={label}
            className={`rounded-lg p-4 text-center border ${
              getStatus(query) === "ok"
                ? "bg-green-50 border-green-200"
                : getStatus(query) === "error"
                ? "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
            }`}
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p
              className={`text-sm font-semibold ${
                getStatus(query) === "ok"
                  ? "text-green-700"
                  : getStatus(query) === "error"
                  ? "text-red-700"
                  : "text-gray-500"
              }`}
            >
              {getStatus(query).toUpperCase()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}