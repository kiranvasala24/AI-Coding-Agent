import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useRunnerStatus } from "@/hooks/use-runner-status";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface RunnerSetupWizardProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RunnerSetupWizard({ trigger, open, onOpenChange }: RunnerSetupWizardProps) {
  const status = useRunnerStatus();
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || supabaseUrl.split("//")[1]?.split(".")[0] || "";

  const envTemplate = `# Runner Configuration
REPO_PATH=/absolute/path/to/your/repo
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_KEY=sb_secret_your_service_role_key
RUNNER_TOKEN=<your-runner-token>
RUNNER_PORT=8787

# Optional
DOCKER_ENABLED=false
COMMAND_TIMEOUT_MS=120000`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label} to clipboard`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Just check if we have a recent heartbeat
    await new Promise(r => setTimeout(r, 1000));

    if (status.isOnline) {
      setTestResult('success');
      toast.success("Runner is connected and online!");
    } else {
      setTestResult('error');
      toast.error("Runner not detected. Make sure it's running.");
    }

    setTesting(false);
  };

  const formatHeartbeatAge = () => {
    if (!status.lastHeartbeat) return "Never";
    const diff = Date.now() - new Date(status.lastHeartbeat).getTime();
    if (diff < 1000) return "just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Runner Setup Wizard
            {status.isOnline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-terminal-green/20 text-terminal-green text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
                Connected
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Configure the local runner daemon to execute tasks on your machine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Step 1: Clone/Navigate */}
          <SetupStep number={1} title="Navigate to runner directory">
            <CodeBlock onCopy={() => copyToClipboard("cd apps/runner && bun install", "commands")}>
              cd apps/runner && bun install
            </CodeBlock>
          </SetupStep>

          {/* Step 2: Create .env */}
          <SetupStep number={2} title="Create .env file">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Create <code className="bg-muted px-1.5 py-0.5 rounded text-xs">apps/runner/.env</code> with:
              </p>

              <div className="relative">
                <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre">
                  {envTemplate}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(envTemplate, ".env template")}
                >
                  {copied === ".env template" ? (
                    <Check className="w-4 h-4 text-terminal-green" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="grid gap-2 text-xs">
                <EnvKeyInfo
                  name="SUPABASE_URL"
                  value={supabaseUrl}
                  onCopy={() => copyToClipboard(supabaseUrl, "SUPABASE_URL")}
                  copied={copied === "SUPABASE_URL"}
                />
                <EnvKeyInfo
                  name="Project ID"
                  value={projectId}
                  onCopy={() => copyToClipboard(projectId, "Project ID")}
                  copied={copied === "Project ID"}
                  hint="For reference only"
                />
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <span className="font-mono text-terminal-yellow">RUNNER_TOKEN</span>
                    <span className="text-muted-foreground ml-2">→ Match with Supabase Secret</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectId}/settings/functions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    Set in Supabase <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div>
                    <span className="font-mono text-terminal-yellow">SUPABASE_SERVICE_KEY</span>
                    <span className="text-muted-foreground ml-2">→ Project Service Role Key</span>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectId}/settings/api`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    Get API Key <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </SetupStep>

          {/* Step 3: Start runner */}
          <SetupStep number={3} title="Start the runner">
            <CodeBlock onCopy={() => copyToClipboard("bun run dev", "start command")}>
              bun run dev
            </CodeBlock>
            <p className="text-xs text-muted-foreground mt-2">
              You should see "Local Runner Daemon" ASCII art and heartbeat confirmations.
            </p>
          </SetupStep>

          {/* Step 4: Test connection */}
          <SetupStep number={4} title="Test connection">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing}
                className="flex-1"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>

              <div className="flex items-center gap-2 text-sm">
                {testResult === 'success' && (
                  <span className="flex items-center gap-1 text-terminal-green">
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </span>
                )}
                {testResult === 'error' && (
                  <span className="flex items-center gap-1 text-terminal-red">
                    <XCircle className="w-4 h-4" />
                    Not found
                  </span>
                )}
              </div>
            </div>

            {status.lastHeartbeat && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last heartbeat:</span>
                  <span className="font-mono">{formatHeartbeatAge()}</span>
                </div>
                {status.version && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-mono">{status.version}</span>
                  </div>
                )}
                {status.runnerId && (
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground">Runner ID:</span>
                    <span className="font-mono truncate max-w-[200px]">{status.runnerId}</span>
                  </div>
                )}
              </div>
            )}
          </SetupStep>

          {/* Troubleshooting */}
          {!status.isOnline && (
            <div className="rounded-lg border border-terminal-yellow/30 bg-terminal-yellow/5 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-terminal-yellow mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-terminal-yellow">Troubleshooting</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground text-xs">
                    <li>• Verify <code className="bg-muted px-1 rounded">RUNNER_TOKEN</code> matches the secret in Cloud</li>
                    <li>• Check that <code className="bg-muted px-1 rounded">SUPABASE_SERVICE_KEY</code> is the service role key (not anon)</li>
                    <li>• Ensure the runner terminal shows "heartbeat ✓ sent" messages</li>
                    <li>• Try restarting the runner if heartbeats fail repeatedly</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SetupStep = React.forwardRef<HTMLDivElement, { number: number; title: string; children: React.ReactNode }>(
  function SetupStep({ number, title, children }, ref) {
    return (
      <div ref={ref} className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
            {number}
          </span>
          <h4 className="font-medium">{title}</h4>
        </div>
        <div className="ml-9">{children}</div>
      </div>
    );
  }
);

function CodeBlock({ children, onCopy }: { children: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-muted/50 rounded-lg p-3 text-sm font-mono overflow-x-auto">
        {children}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? (
          <Check className="w-4 h-4 text-terminal-green" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

function EnvKeyInfo({
  name,
  value,
  onCopy,
  copied,
  hint
}: {
  name: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
      <div className="flex items-center gap-2">
        <span className="font-mono text-terminal-cyan">{name}</span>
        {hint && <span className="text-muted-foreground">({hint})</span>}
      </div>
      <div className="flex items-center gap-2">
        <code className="font-mono text-xs truncate max-w-[200px]">{value}</code>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCopy}>
          {copied ? (
            <Check className="w-3 h-3 text-terminal-green" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
