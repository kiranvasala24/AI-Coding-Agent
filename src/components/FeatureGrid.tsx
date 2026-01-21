import { 
  Brain, 
  Shield, 
  Zap, 
  GitMerge, 
  Container, 
  Search,
  FileCode,
  Terminal,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Brain,
    title: "Claude-Powered Agent",
    description: "Leverages Claude's tool-use capabilities for intelligent code analysis and generation.",
    gradient: "from-terminal-cyan/20 to-transparent",
  },
  {
    icon: Shield,
    title: "Human-in-the-Loop",
    description: "All changes require explicit approval. The agent proposes, you decide.",
    gradient: "from-terminal-green/20 to-transparent",
  },
  {
    icon: Container,
    title: "Sandboxed Execution",
    description: "Tests run in isolated Docker containers. Network disabled, filesystem read-only.",
    gradient: "from-terminal-purple/20 to-transparent",
  },
  {
    icon: GitMerge,
    title: "Git-Native Workflow",
    description: "Creates branches, commits with context, and maintains clean history.",
    gradient: "from-terminal-yellow/20 to-transparent",
  },
  {
    icon: Search,
    title: "Semantic Indexing",
    description: "TypeScript Compiler API powered understanding of your entire codebase.",
    gradient: "from-terminal-cyan/20 to-transparent",
  },
  {
    icon: Zap,
    title: "Constraint-Aware",
    description: "Respects file allowlists, max diff sizes, and custom safety rules.",
    gradient: "from-terminal-red/20 to-transparent",
  },
  {
    icon: FileCode,
    title: "Unified Diffs",
    description: "Changes presented as clean, reviewable unified diffs with context.",
    gradient: "from-terminal-green/20 to-transparent",
  },
  {
    icon: Terminal,
    title: "CLI-First",
    description: "Powerful command-line interface with optional VS Code extension.",
    gradient: "from-terminal-purple/20 to-transparent",
  },
  {
    icon: Lock,
    title: "Risk Assessment",
    description: "Automatically flags changes to public APIs, auth, and sensitive files.",
    gradient: "from-terminal-yellow/20 to-transparent",
  },
];

export function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((feature, index) => (
        <div
          key={feature.title}
          className="group relative p-5 rounded-xl border border-border bg-card/50 hover:border-primary/50 transition-all duration-300 hover:bg-card overflow-hidden"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Gradient background */}
          <div className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            feature.gradient
          )} />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-secondary group-hover:bg-primary/10 transition-colors">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
