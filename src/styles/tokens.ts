/**
 * Design Token Registry
 * 
 * Single source of truth for all required CSS tokens.
 * This list is used for validation during dev startup and can be used for CI checks.
 */

/**
 * Required CSS custom properties that must be defined in index.css
 * If any of these are missing, the UI may render incorrectly or go blank.
 */
export const REQUIRED_CSS_TOKENS = [
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
  
  // Terminal colors (critical for dashboard)
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
] as const;

/**
 * Token categories for documentation and organization
 */
export const TOKEN_CATEGORIES = {
  core: [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
    "--border", "--input", "--ring", "--radius",
  ],
  semantic: [
    "--success", "--success-foreground",
    "--warning", "--warning-foreground",
  ],
  terminal: [
    "--terminal-bg", "--terminal-border",
    "--terminal-green", "--terminal-cyan", "--terminal-yellow",
    "--terminal-red", "--terminal-purple", "--terminal-blue",
  ],
  sidebar: [
    "--sidebar-background", "--sidebar-foreground",
    "--sidebar-primary", "--sidebar-primary-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground",
    "--sidebar-border", "--sidebar-ring",
  ],
} as const;

/**
 * Validate that all required tokens exist in a CSS string
 * Useful for CI checks on index.css
 */
export function validateTokensInCSS(cssContent: string): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  for (const token of REQUIRED_CSS_TOKENS) {
    // Check if the token is defined (e.g., "--background:" appears in the CSS)
    if (!cssContent.includes(`${token}:`)) {
      missing.push(token);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}
