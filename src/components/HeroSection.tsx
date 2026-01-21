import { ArrowRight, Bot, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Terminal } from "@/components/Terminal";

const terminalLines = [
  { type: "command" as const, content: "agent run \"Add user authentication to the API\"", delay: 1200 },
  { type: "info" as const, content: "📋 Creating structured plan...", delay: 800 },
  { type: "output" as const, content: "   Step 1: Analyze existing auth patterns", delay: 600 },
  { type: "output" as const, content: "   Step 2: Create middleware in src/auth/", delay: 600 },
  { type: "output" as const, content: "   Step 3: Update route handlers", delay: 600 },
  { type: "info" as const, content: "🔧 Gathering context via tools...", delay: 1000 },
  { type: "output" as const, content: "   → search: \"authentication middleware\"", delay: 500 },
  { type: "output" as const, content: "   → open: src/middleware/index.ts", delay: 500 },
  { type: "info" as const, content: "📝 Generating patch...", delay: 1000 },
  { type: "success" as const, content: "✓ Patch created: 3 files, +127 -12 lines", delay: 800 },
  { type: "info" as const, content: "🧪 Running tests in sandbox...", delay: 1500 },
  { type: "success" as const, content: "✓ All 24 tests passed", delay: 800 },
  { type: "success" as const, content: "⏳ Awaiting approval → agent apply abc123", delay: 0 },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-grid-pattern bg-grid-40 opacity-[0.02]" />
      
      {/* Animated glow orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-terminal-purple/10 rounded-full blur-[120px] animate-pulse-slow" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Built for Anthropic</span>
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-foreground">AI Coding Agent for</span>
                <br />
                <span className="text-gradient">Large TypeScript</span>
                <br />
                <span className="text-foreground">Codebases</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                A local-first AI agent that understands your repo, proposes scoped changes,
                validates them with tests, and requires your approval before applying.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="w-4 h-4 text-primary" />
                <span>Claude Tool-Use</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-success" />
                <span>Human Approval Gate</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Button variant="hero" size="xl">
                Get Started
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="xl">
                View on GitHub
              </Button>
            </div>
          </div>

          {/* Right column - Terminal demo */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-3xl" />
            <Terminal
              lines={terminalLines}
              title="~/my-project"
              className="relative shadow-2xl shadow-primary/10"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
