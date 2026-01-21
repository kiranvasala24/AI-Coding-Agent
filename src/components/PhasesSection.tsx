import { PhaseCard } from "@/components/PhaseCard";
import { 
  FolderGit2, 
  Terminal, 
  GitBranch, 
  Database, 
  Container,
  Layers,
  Shield
} from "lucide-react";

const phases = [
  {
    phase: 0,
    title: "Repo + Rules",
    description: "Monorepo setup with core packages and non-negotiable safety constraints.",
    icon: FolderGit2,
    features: [
      "apps/ui + apps/server structure",
      "Core packages for agent loop",
      "Safety rules in README",
    ],
    status: "completed" as const,
  },
  {
    phase: 1,
    title: "CLI MVP",
    description: "End-to-end loop: read files, propose diffs, and wait for approval.",
    icon: Terminal,
    features: [
      "agent init & agent run commands",
      "Tool interfaces (search, open, list)",
      "Structured plan + patch output",
    ],
    status: "current" as const,
  },
  {
    phase: 2,
    title: "Approval Gate",
    description: "Human approval becomes a real, enforced gate with Git integration.",
    icon: GitBranch,
    features: [
      "Patch storage in .agent/patches/",
      "agent apply command",
      "Branch creation workflow",
    ],
    status: "upcoming" as const,
  },
  {
    phase: 3,
    title: "TypeScript Indexing",
    description: "Semantic understanding via TypeScript Compiler API + SQLite.",
    icon: Database,
    features: [
      "Symbol & reference extraction",
      "Import graph analysis",
      "symbol_lookup & find_references",
    ],
    status: "upcoming" as const,
  },
  {
    phase: 4,
    title: "Docker Sandbox",
    description: "Isolated, reproducible test execution in containerized environment.",
    icon: Container,
    features: [
      "Read-only mount + overlay",
      "Network disabled execution",
      "Test selection via import graph",
    ],
    status: "upcoming" as const,
  },
  {
    phase: 5,
    title: "React UI",
    description: "Trust-focused UX with streaming events and visual diff review.",
    icon: Layers,
    features: [
      "Plan → Diff → Verify → Approve",
      "SSE/WebSocket streaming",
      "Click-to-approve interface",
    ],
    status: "upcoming" as const,
  },
  {
    phase: 6,
    title: "Agent-Grade",
    description: "Production guardrails, failure handling, and risk assessment.",
    icon: Shield,
    features: [
      "Command & path allowlists",
      "Auto-summarize failures",
      "Risk score with explanations",
    ],
    status: "upcoming" as const,
  },
];

export function PhasesSection() {
  return (
    <section id="phases" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Development <span className="text-gradient">Roadmap</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A phased approach to building a production-ready AI coding agent,
            from CLI skeleton to full-featured UI.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {phases.map((phase, index) => (
            <PhaseCard
              key={phase.phase}
              {...phase}
              delay={index * 100}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
