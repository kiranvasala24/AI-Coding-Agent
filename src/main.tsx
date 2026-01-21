import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { runDiagnostics } from "./lib/diagnostics";

// Run diagnostics in dev mode
if (import.meta.env.DEV) {
  // Wait for DOM to be ready before checking CSS tokens
  setTimeout(async () => {
    const { hasCriticalFailure } = await runDiagnostics();
    if (hasCriticalFailure) {
      console.error("%c⚠️ Critical startup issues detected! UI may not render correctly.", "color: #ef4444; font-weight: bold");
    }
  }, 100);
}

createRoot(document.getElementById("root")!).render(<App />);
