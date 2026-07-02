// Перенаправляет ВСЕ запросы к Supabase через прокси https://lovable.proxy.atiks.org
// Режим ref-passthrough: первый сегмент пути = project ref.
// Импортируется первой строкой в main.tsx — до создания supabase-клиента.
//
// Дополнительно ведёт журнал запросов/ответов (доступен по Ctrl+[).

const PROXY_ORIGIN = "https://lovable.proxy.atiks.org";
const PROXY_WS_ORIGIN = "wss://lovable.proxy.atiks.org";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
let SUPABASE_HOST = "";
let PROJECT_REF = "";
try {
  const u = new URL(SUPABASE_URL);
  SUPABASE_HOST = u.host;
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

// ============ Журнал запросов ============
export type ProxyLogEntry = {
  id: string;
  ts: number;
  method: string;
  url: string;
  originalUrl: string;
  curl: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  responseBodyTruncated?: boolean;
  error?: string;
};

const MAX_LOG = 200;
const MAX_BODY_CHARS = 20_000;

type Listener = (entries: ProxyLogEntry[]) => void;

const listeners = new Set<Listener>();
const entries: ProxyLogEntry[] = [];

function notify() {
  const snap = entries.slice();
  listeners.forEach((l) => {
    try { l(snap); } catch { /* noop */ }
  });
}

function push(entry: ProxyLogEntry) {
  entries.unshift(entry);
  if (entries.length > MAX_LOG) entries.length = MAX_LOG;
  notify();
}

function update(id: string, patch: Partial<ProxyLogEntry>) {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], ...patch };
    notify();
  }
}

function shellQuote(s: string) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function headersToObj(h: HeadersInit | undefined | Headers): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => { out[k] = v; });
    return out;
  }
  if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v;
    return out;
  }
  return { ...(h as Record<string, string>) };
}

function buildCurl(method: string, url: string, headers: Record<string, string>, body: BodyInit | null | undefined): string {
  const parts = [`curl -X ${method}`, shellQuote(url)];
  for (const [k, v] of Object.entries(headers)) {
    // не логируем секреты полностью — маскируем токены
    let val = v;
    if (/authorization/i.test(k) && val.length > 20) {
      val = val.slice(0, 12) + "…" + val.slice(-6);
    }
    if (/apikey/i.test(k) && val.length > 20) {
      val = val.slice(0, 10) + "…" + val.slice(-6);
    }
    parts.push(`-H ${shellQuote(`${k}: ${val}`)}`);
  }
  if (body != null) {
    if (typeof body === "string") {
      parts.push(`--data-raw ${shellQuote(body.length > 4000 ? body.slice(0, 4000) + "…[truncated]" : body)}`);
    } else if (body instanceof FormData) {
      parts.push(`# FormData (multipart)`);
    } else if (body instanceof Blob) {
      parts.push(`# Blob body (${body.size} bytes, ${body.type || "unknown"})`);
    } else if (body instanceof ArrayBuffer) {
      parts.push(`# ArrayBuffer (${body.byteLength} bytes)`);
    } else {
      parts.push(`# body (${(body as { constructor?: { name?: string } }).constructor?.name ?? typeof body})`);
    }
  }
  return parts.join(" \\\n  ");
}

export const proxyLog = {
  getAll(): ProxyLogEntry[] { return entries.slice(); },
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    fn(entries.slice());
    return () => listeners.delete(fn);
  },
  clear() {
    entries.length = 0;
    notify();
  },
};

if (typeof window !== "undefined") {
  (window as unknown as { __proxyLog: typeof proxyLog }).__proxyLog = proxyLog;
}

// ============ Патчим fetch и WebSocket ============
if (SUPABASE_HOST && PROJECT_REF && typeof window !== "undefined") {
  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let originalUrl = "";
    let method = init?.method || "GET";
    let reqHeaders: Record<string, string> = {};
    let reqBody: BodyInit | null | undefined = init?.body;

    if (typeof input === "string") {
      originalUrl = input;
    } else if (input instanceof URL) {
      originalUrl = input.toString();
    } else if (input instanceof Request) {
      originalUrl = input.url;
      method = init?.method || input.method;
      reqHeaders = headersToObj(input.headers);
    }

    const rewritten = rewriteUrl(originalUrl);
    const isProxied = rewritten !== originalUrl;

    // merge init headers
    if (init?.headers) {
      reqHeaders = { ...reqHeaders, ...headersToObj(init.headers) };
    }

    let logId: string | null = null;
    let startedAt = 0;

    if (isProxied) {
      logId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      startedAt = performance.now();
      push({
        id: logId,
        ts: Date.now(),
        method: method.toUpperCase(),
        url: rewritten,
        originalUrl,
        curl: buildCurl(method.toUpperCase(), rewritten, reqHeaders, reqBody),
      });
    }

    try {
      let response: Response;
      if (typeof input === "string") {
        response = await origFetch(rewritten, init);
      } else if (input instanceof URL) {
        response = await origFetch(rewritten, init);
      } else {
        // Request object
        const newReq = rewritten === input.url ? input : new Request(rewritten, input);
        response = await origFetch(newReq, init);
      }

      if (logId) {
        const clone = response.clone();
        const respHeaders: Record<string, string> = {};
        clone.headers.forEach((v, k) => { respHeaders[k] = v; });
        // читаем текст, не ломая исходный response
        clone.text().then((txt) => {
          const truncated = txt.length > MAX_BODY_CHARS;
          update(logId!, {
            status: response.status,
            statusText: response.statusText,
            durationMs: Math.round(performance.now() - startedAt),
            responseHeaders: respHeaders,
            responseBody: truncated ? txt.slice(0, MAX_BODY_CHARS) : txt,
            responseBodyTruncated: truncated,
          });
        }).catch(() => {
          update(logId!, {
            status: response.status,
            statusText: response.statusText,
            durationMs: Math.round(performance.now() - startedAt),
            responseHeaders: respHeaders,
          });
        });
      }
      return response;
    } catch (err) {
      if (logId) {
        update(logId, {
          durationMs: Math.round(performance.now() - startedAt),
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
  };

  // WebSocket (Supabase Realtime)
  const OrigWS = window.WebSocket;
  class ProxiedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      const original = typeof url === "string" ? url : url.toString();
      const rewritten = rewriteUrl(original);
      if (rewritten !== original) {
        push({
          id: `ws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          method: "WS",
          url: rewritten,
          originalUrl: original,
          curl: `# WebSocket connect\n# ${rewritten}`,
        });
      }
      super(rewritten, protocols);
    }
  }
  (window as unknown as { WebSocket: typeof WebSocket }).WebSocket = ProxiedWS as unknown as typeof WebSocket;
}

export {};
