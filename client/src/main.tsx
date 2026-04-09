import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 30 seconds by default to reduce redundant API calls
      staleTime: 30 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus by default (prevents excessive requests)
      refetchOnWindowFocus: false,
      // Retry failed requests only once
      retry: 1,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        // 攔截平台 Rate Limit 回傳（純文字「Rate exceeded.」而非 JSON）
        // 將其轉換為 tRPC 可解析的 JSON 錯誤格式，避免顯示技術性錯誤訊息
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          const text = await response.text();
          const isRateLimit =
            text.toLowerCase().includes('rate') ||
            text.toLowerCase().includes('exceeded') ||
            response.status === 429;
          const errorMsg = isRateLimit
            ? '請求過於頻繁，請稍後幾秒再試'
            : `伺服器暫時無回應，請稍後再試`;
          console.warn('[API] Non-JSON response intercepted:', response.status, text.slice(0, 100));
          // 模擬 tRPC 批次錯誤回傳格式
          return new Response(
            JSON.stringify([{ error: { json: { message: errorMsg, code: -32600, data: { code: 'TOO_MANY_REQUESTS', httpStatus: response.status } } } }]),
            { status: 200, headers: { 'content-type': 'application/json' } }
          );
        }

        return response;
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
