import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const IndexNew = lazy(() => import("./IndexNew"));
const IndexLegacy = lazy(() => import("./IndexLegacy"));

type Version = "new" | "legacy";

const VERSION_CACHE_KEY = "homepage_version_v1";

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function Index() {
  const [version, setVersion] = useState<Version | null>(() => {
    try {
      const cached = localStorage.getItem(VERSION_CACHE_KEY);
      return cached === "legacy" || cached === "new" ? (cached as Version) : null;
    } catch { return null; }
  });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-products`)
      .then((r) => r.json())
      .then((json) => {
        const v: Version = json?.homepage_version === "legacy" ? "legacy" : "new";
        setVersion(v);
        try { localStorage.setItem(VERSION_CACHE_KEY, v); } catch { /* ignore */ }
      })
      .catch(() => setVersion((prev) => prev ?? "new"));
  }, []);

  if (!version) return <Fallback />;

  return (
    <Suspense fallback={<Fallback />}>
      {version === "legacy" ? <IndexLegacy /> : <IndexNew />}
    </Suspense>
  );
}
