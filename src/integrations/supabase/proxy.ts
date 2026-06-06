// Перенаправляет все запросы к Supabase через прокси https://lovable.proxy.atiks.org
// Используется режим ref-passthrough: первый сегмент пути = project ref.
// Импортируется первой строкой в main.tsx — до создания supabase-клиента.

const PROXY_ORIGIN = "https://lovable.proxy.atiks.org";
const PROXY_WS_ORIGIN = "wss://lovable.proxy.atiks.org";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
let SUPABASE_HOST = "";
let PROJECT_REF = "";
try {
  const u = new URL(SUPABASE_URL);
  SUPABASE_HOST = u.host; // e.g. zqegcsutpwwrahfiwaic.supabase.co
  PROJECT_REF = u.host.split(".")[0];
} catch {
  // no-op
}

function rewriteUrl(input: string): string {
  if (!SUPABASE_HOST || !PROJECT_REF) return input;
  try {
    const url = new URL(input);
    if (url.host !== SUPABASE_HOST) return input;
    const isWs = url.protocol === "ws:" || url.protocol === "wss:";
    const base = isWs ? PROXY_WS_ORIGIN : PROXY_ORIGIN;
    return `${base}/${PROJECT_REF}${url.pathname}${url.search}`;
  } catch {
    return input;
  }
}

if (SUPABASE_HOST && PROJECT_REF && typeof window !== "undefined") {
  // fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return origFetch(rewriteUrl(input), init);
    }
    if (input instanceof URL) {
      return origFetch(rewriteUrl(input.toString()), init);
    }
    if (input instanceof Request) {
      const newUrl = rewriteUrl(input.url);
      if (newUrl === input.url) return origFetch(input, init);
      const cloned = new Request(newUrl, input);
      return origFetch(cloned, init);
    }
    return origFetch(input as RequestInfo, init);
  };

  // WebSocket (Supabase Realtime)
  const OrigWS = window.WebSocket;
  class ProxiedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(rewriteUrl(typeof url === "string" ? url : url.toString()), protocols);
    }
  }
  // @ts-expect-error override
  window.WebSocket = ProxiedWS;
}

export {};
