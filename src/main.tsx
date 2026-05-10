import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare global {
  interface Window {
    __setBootProgress?: (value: number, message?: string) => void;
  }
}

const rootEl = document.getElementById("root")!;
window.__setBootProgress?.(65, "Запуск приложения…");
// Маркер для index.html: приложение успешно начало монтирование.
rootEl.setAttribute("data-app-mounted", "1");

createRoot(rootEl).render(<App onReady={() => window.__setBootProgress?.(100, "Готово")} />);
