/**
 * Token Validation Script
 * 
 * Run with: npx tsx scripts/validate-tokens.ts
 * 
 * Validates that all required CSS tokens are defined in index.css.
 * Can be used in CI to catch missing tokens before deploy.
 */

import { readFileSync } from "fs";
import { join } from "path";

// Import the token list (relative path for script execution)
const REQUIRED_CSS_TOKENS = [
  // Core colors
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--radius",
  
  // Semantic colors
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
  
  // Terminal colors
  "--terminal-bg",
  "--terminal-border",
  "--terminal-green",
  "--terminal-cyan",
  "--terminal-yellow",
  "--terminal-red",
  "--terminal-purple",
  "--terminal-blue",
  
  // Sidebar
  "--sidebar-background",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
];

function main() {
  console.log("🔍 Validating CSS tokens...\n");
  
  const cssPath = join(process.cwd(), "src", "index.css");
  
  let cssContent: string;
  try {
    cssContent = readFileSync(cssPath, "utf-8");
  } catch (error) {
    console.error(`❌ Could not read ${cssPath}`);
    process.exit(1);
  }
  
  const missing: string[] = [];
  const found: string[] = [];
  
  for (const token of REQUIRED_CSS_TOKENS) {
    if (cssContent.includes(`${token}:`)) {
      found.push(token);
    } else {
      missing.push(token);
    }
  }
  
  console.log(`✓ Found ${found.length}/${REQUIRED_CSS_TOKENS.length} tokens\n`);
  
  if (missing.length > 0) {
    console.error("❌ Missing tokens:");
    for (const token of missing) {
      console.error(`   - ${token}`);
    }
    console.error("\nAdd these tokens to src/index.css in the :root section.\n");
    process.exit(1);
  }
  
  console.log("✅ All required tokens are defined!\n");
  process.exit(0);
}

main();
