import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Database, 
  Radio, 
  Server, 
  Clock, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "checking";
  latency?: number;
  message?: string;
  lastChecked?: Date;
}

export default function Health() {
  const [checks, setChecks] = useState<HealthCheck[]>([
    { name: "Database", status: "checking" },
    { name: "Edge Functions", status: "checking" },
    { name: "Realtime", status: "checking" },
    { name: "Runner Heartbeat", status: "checking" },
  ]);
  const [stats, setStats] = useState<{
    totalRuns: number;
    recentRuns: number;
    passRate: number;
    avgDuration: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runHealthChecks = async () => {
    setIsRefreshing(true);
    const newChecks: HealthCheck[] = [];

    // 1. Database connectivity
    const dbStart = Date.now();
    try {
      const { error } = await supabase.from("runs").select("id").limit(1);
      newChecks.push({
        name: "Database",
        status: error ? "unhealthy" : "healthy",
        latency: Date.now() - dbStart,
        message: error?.message || "Connected",
        lastChecked: new Date(),
      });
    } catch (e) {
      newChecks.push({
        name: "Database",
        status: "unhealthy",
        latency: Date.now() - dbStart,
        message: e instanceof Error ? e.message : "Connection failed",
        lastChecked: new Date(),
      });
    }

    // 2. Edge Functions - use dedicated /admin/ping endpoint
    const fnStart = Date.now();
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/ping`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        newChecks.push({
          name: "Edge Functions",
          status: "healthy",
          latency: Date.now() - fnStart,
          message: `Reachable (v${data.version || "1.0"})`,
          lastChecked: new Date(),
        });
      } else {
        // Any non-5xx response means function is deployed
        newChecks.push({
          name: "Edge Functions",
          status: response.status < 500 ? "healthy" : "degraded",
          latency: Date.now() - fnStart,
          message: `Status ${response.status}`,
          lastChecked: new Date(),
        });
      }
    } catch (e) {
      newChecks.push({
        name: "Edge Functions",
        status: "unhealthy",
        latency: Date.now() - fnStart,
        message: "Unreachable",
        lastChecked: new Date(),
      });
    }

    // 3. Realtime
    const rtStart = Date.now();
    try {
      const channel = supabase.channel("health-check");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 5000);
        channel.subscribe((status) => {
          clearTimeout(timeout);
          if (status === "SUBSCRIBED") {
            resolve();
          } else if (status === "CHANNEL_ERROR") {
            reject(new Error("Channel error"));
          }
        });
      });
      await supabase.removeChannel(channel);
      newChecks.push({
        name: "Realtime",
        status: "healthy",
        latency: Date.now() - rtStart,
        message: "Connected",
        lastChecked: new Date(),
      });
    } catch (e) {
      newChecks.push({
        name: "Realtime",
        status: "unhealthy",
        latency: Date.now() - rtStart,
        message: e instanceof Error ? e.message : "Connection failed",
        lastChecked: new Date(),
      });
    }

    // 4. Runner Heartbeat - this is optional in demo mode
    const demoModeEnabled = import.meta.env.VITE_DEMO_MODE_ENABLED === "true";
    try {
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: events } = await supabase
        .from("run_events")
        .select("created_at, payload")
        .eq("event_type", "RUNNER_HEARTBEAT")
        .gte("created_at", thirtySecondsAgo)
        .order("created_at", { ascending: false })
        .limit(1);

      if (events && events.length > 0) {
        const lastHeartbeat = new Date(events[0].created_at);
        const ageMs = Date.now() - lastHeartbeat.getTime();
        newChecks.push({
          name: "Runner Heartbeat",
          status: ageMs < 15000 ? "healthy" : "degraded",
          latency: ageMs,
          message: `Last seen ${Math.round(ageMs / 1000)}s ago`,
          lastChecked: new Date(),
        });
      } else {
        // No runner is OK if demo mode is enabled - show as "optional"
        newChecks.push({
          name: "Runner Heartbeat",
          status: demoModeEnabled ? "degraded" : "unhealthy",
          message: demoModeEnabled 
            ? "Not connected (optional in demo mode)" 
            : "No runner connected",
          lastChecked: new Date(),
        });
      }
    } catch (e) {
      newChecks.push({
        name: "Runner Heartbeat",
        status: "degraded",
        message: "Check failed",
        lastChecked: new Date(),
      });
    }

    setChecks(newChecks);

    // Fetch stats
    try {
      const { data: allRuns } = await supabase
        .from("runs")
        .select("id, status, created_at, updated_at");

      if (allRuns) {
        const oneHourAgo = new Date(Date.now() - 3600000);
        const recentRuns = allRuns.filter(
          (r) => new Date(r.created_at) > oneHourAgo
        );
        const completedRuns = allRuns.filter(
          (r) => r.status === "completed" || r.status === "failed"
        );
        const passedRuns = allRuns.filter((r) => r.status === "completed");

        const durations = completedRuns
          .map((r) => {
            const start = new Date(r.created_at).getTime();
            const end = new Date(r.updated_at).getTime();
            return end - start;
          })
          .filter((d) => d > 0 && d < 3600000); // Filter out invalid durations

        setStats({
          totalRuns: allRuns.length,
          recentRuns: recentRuns.length,
          passRate:
            completedRuns.length > 0
              ? Math.round((passedRuns.length / completedRuns.length) * 100)
              : 0,
          avgDuration:
            durations.length > 0
              ? Math.round(
                  durations.reduce((a, b) => a + b, 0) / durations.length / 1000
                )
              : 0,
        });
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }

    setIsRefreshing(false);
  };

  useEffect(() => {
    runHealthChecks();
    const interval = setInterval(runHealthChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Degraded</Badge>;
      case "unhealthy":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Unhealthy</Badge>;
      default:
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  // Overall status: only unhealthy if core services (DB, Functions, Realtime) fail
  // Runner is optional - missing runner only degrades status
  const coreChecks = checks.filter((c) => c.name !== "Runner Heartbeat");
  const runnerCheck = checks.find((c) => c.name === "Runner Heartbeat");
  
  const coreHealthy = coreChecks.every((c) => c.status === "healthy");
  const coreUnhealthy = coreChecks.some((c) => c.status === "unhealthy");
  
  const overallStatus = coreUnhealthy
    ? "unhealthy"
    : !coreHealthy || runnerCheck?.status === "unhealthy"
    ? "degraded"
    : "healthy";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Health</h1>
            <p className="text-muted-foreground mt-1">
              System status and diagnostics
            </p>
          </div>
          <div className="flex items-center gap-4">
            {getStatusBadge(overallStatus)}
            <Button
              variant="outline"
              size="sm"
              onClick={runHealthChecks}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Health Checks */}
        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check) => (
            <Card key={check.name}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {check.name === "Database" && <Database className="h-5 w-5 text-muted-foreground" />}
                    {check.name === "Edge Functions" && <Server className="h-5 w-5 text-muted-foreground" />}
                    {check.name === "Realtime" && <Radio className="h-5 w-5 text-muted-foreground" />}
                    {check.name === "Runner Heartbeat" && <Activity className="h-5 w-5 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{check.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {check.message || "Checking..."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {check.latency !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        {check.latency}ms
                      </span>
                    )}
                    {getStatusIcon(check.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stats */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Run Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-2xl font-bold">{stats.totalRuns}</p>
                  <p className="text-sm text-muted-foreground">Total Runs</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.recentRuns}</p>
                  <p className="text-sm text-muted-foreground">Last Hour</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.passRate}%</p>
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgDuration}s</p>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant="outline" asChild>
              <a href="/">Dashboard</a>
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Hard Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
