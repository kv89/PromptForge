import axios from "axios";

import { toast } from "@/components/ui/Toast";
import { auth } from "@/config/firebase";
import { getApiErrorMessage } from "@/lib/errors";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

  export const api = axios.create({
    baseURL,
    timeout: 1200000,  // 20 minutes — needed for stability tests (5 runs × ~2min each)
  });

// Attach the current user's Firebase ID token to every outgoing request.
api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralised error handling: redirect on auth failures, and surface every
// other API error as a human-readable global toast.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
      return Promise.reject(error);
    }

    const message = getApiErrorMessage(error);
    toast.error(message);
    return Promise.reject(error);
  },
);

export default api;
