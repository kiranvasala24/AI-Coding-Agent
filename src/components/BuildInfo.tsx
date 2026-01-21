import { Badge } from "@/components/ui/badge";

const BUILD_INFO = {
  version: import.meta.env.VITE_APP_VERSION || "dev",
  commit: import.meta.env.VITE_COMMIT_SHA?.slice(0, 7) || "local",
  env: import.meta.env.VITE_ENV || (import.meta.env.DEV ? "development" : "production"),
  buildTime: import.meta.env.VITE_BUILD_TIME || new Date().toISOString(),
};

export function BuildInfo() {
  const envColors: Record<string, string> = {
    development: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    staging: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    production: "bg-green-500/10 text-green-500 border-green-500/20",
  };

  const envColor = envColors[BUILD_INFO.env] || envColors.development;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className={envColor}>
        {BUILD_INFO.env}
      </Badge>
      <span className="font-mono">
        v{BUILD_INFO.version}
      </span>
      <span className="text-muted-foreground/50">•</span>
      <span className="font-mono text-muted-foreground/70">
        {BUILD_INFO.commit}
      </span>
    </div>
  );
}
