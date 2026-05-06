import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root")!;
// Очищаем initial HTML-лоадер из index.html перед монтированием React,
// чтобы React не смешивал свой VDOM с пред-рендеренной разметкой.
rootEl.innerHTML = "";
// Маркер для index.html: приложение успешно начало монтирование.
rootEl.setAttribute("data-app-mounted", "1");

createRoot(rootEl).render(<App />);
