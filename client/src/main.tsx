import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const CLIENT_NETWORK_ERROR_PATTERNS = [
  /aborterror/i,
  /failed to fetch/i,
  /load failed/i,
  /networkerror/i,
];

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  toast.error("Admin sign-in is required for this action.", {
    id: "auth-required",
  });
};

const isClientNetworkInterruption = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  return CLIENT_NETWORK_ERROR_PATTERNS.some(pattern =>
    pattern.test(error.message)
  );
};

const logApiError = (
  label: "Query" | "Mutation",
  error: unknown,
  context: unknown
) => {
  if (isClientNetworkInterruption(error)) {
    console.warn(`[API ${label} Warning]`, { context, error });
    return;
  }

  console.error(`[API ${label} Error]`, { context, error });
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    logApiError("Query", error, event.query.queryKey);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    logApiError("Mutation", error, event.mutation.options.mutationKey);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
