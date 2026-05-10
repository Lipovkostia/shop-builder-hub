import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const App = lazy(() => import("./App.tsx"));

const BootstrapLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const rootEl = document.getElementById("root")!;
// Очищаем initial HTML-лоадер из index.html перед монтированием React,
// чтобы React не смешивал свой VDOM с пред-рендеренной разметкой.
rootEl.innerHTML = "";
// Маркер для index.html: приложение успешно начало монтирование.
rootEl.setAttribute("data-app-mounted", "1");

createRoot(rootEl).render(
  <Suspense fallback={<BootstrapLoader />}>
    <App />
  </Suspense>
);
