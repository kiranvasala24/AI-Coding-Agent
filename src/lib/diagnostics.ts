/**
 * Startup Diagnostics (dev only)
 * 
 * Validates that required tokens, env vars, and endpoints are available.
 */

import { REQUIRED_CSS_TOKENS } from "@/styles/tokens";

interface DiagnosticResult {
  category: string;
  check: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

const results: DiagnosticResult[] = [];

function addResult(result: DiagnosticResult) {
  results.push(result);
  const icon = result.status === "pass" ? "✓" : result.status === "warn" ? "⚠" : "✗";
  const color = result.status === "pass" ? "color: #22c55e" : result.status === "warn" ? "color: #eab308" : "color: #ef4444";
  console.log(`%c${icon} [${result.category}] ${result.check}: ${result.message}`, color);
}

/**
 * Validate CSS tokens exist in the document
 */
function validateCSSTokens() {
  const style = getComputedStyle(document.documentElement);
  const missing: string[] = [];
  
  for (const token of REQUIRED_CSS_TOKENS) {
    const value = style.getPropertyValue(token).trim();
    if (!value) {
      missing.push(token);
    }
  }
  
  if (missing.length > 0) {
    addResult({
      category: "CSS Tokens",
      check: "Required tokens",
      status: "fail",
      message: `Missing: ${missing.join(", ")}`,
    });
    return false;
  }
  
  addResult({
    category: "CSS Tokens",
    check: "Required tokens",
    status: "pass",
    message: `All ${REQUIRED_CSS_TOKENS.length} tokens present`,
  });
  return true;
}

/**
 * Validate Supabase environment variables
 */
function validateSupabaseEnv() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url) {
    addResult({
      category: "Supabase",
      check: "VITE_SUPABASE_URL",
      status: "fail",
      message: "Not set",
    });
    return false;
  }
  
  if (!key) {
    addResult({
      category: "Supabase",
      check: "VITE_SUPABASE_PUBLISHABLE_KEY",
      status: "fail", 
      message: "Not set",
    });
    return false;
  }
  
  addResult({
    category: "Supabase",
    check: "Environment",
    status: "pass",
    message: `URL and key present`,
  });
  return true;
}

/**
 * Check if runner endpoints are reachable
 */
async function checkRunnerEndpoints() {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) {
    addResult({
      category: "Runner",
      check: "Endpoints",
      status: "warn",
      message: "Cannot check - Supabase URL missing",
    });
    return;
  }
  
  const endpoints = [
    "/functions/v1/runs",
    "/functions/v1/runner",
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "OPTIONS",
      });
      
      if (response.ok || response.status === 204) {
        addResult({
          category: "Runner",
          check: endpoint,
          status: "pass",
          message: "Reachable",
        });
      } else {
        addResult({
          category: "Runner",
          check: endpoint,
          status: "warn",
          message: `Status ${response.status}`,
        });
      }
    } catch {
      addResult({
        category: "Runner",
        check: endpoint,
        status: "warn",
        message: "Not reachable (may be expected if not deployed)",
      });
    }
  }
}

/**
 * Run all diagnostics
 */
export async function runDiagnostics(): Promise<{
  passed: boolean;
  results: DiagnosticResult[];
  hasCriticalFailure: boolean;
}> {
  results.length = 0;
  
  console.group("%c🔍 Startup Diagnostics", "font-weight: bold; font-size: 14px");
  
  const tokensPassed = validateCSSTokens();
  const envPassed = validateSupabaseEnv();
  await checkRunnerEndpoints();
  
  console.groupEnd();
  
  const hasCriticalFailure = !tokensPassed; // CSS tokens are critical for UI
  const passed = results.every(r => r.status === "pass");
  
  return { passed, results: [...results], hasCriticalFailure };
}

/**
 * Get any failed diagnostics for display
 */
export function getFailedDiagnostics(): DiagnosticResult[] {
  return results.filter(r => r.status !== "pass");
}
