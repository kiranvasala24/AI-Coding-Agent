import { Bot, Github, Book, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RunnerStatusBadge } from "@/components/RunnerStatusBadge";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg">
              <span className="text-foreground">Code</span>
              <span className="text-primary">Agent</span>
            </span>
          </div>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#workflow" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Workflow
            </a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#phases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Roadmap
            </a>
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <RunnerStatusBadge className="hidden md:flex" />
            <Button variant="ghost" size="sm" className="hidden md:flex">
              <Book className="w-4 h-4 mr-2" />
              Docs
            </Button>
            <Button variant="outline" size="sm" className="hidden md:flex">
              <Github className="w-4 h-4 mr-2" />
              GitHub
            </Button>
            <Button variant="hero" size="sm">
              <Terminal className="w-4 h-4 mr-2" />
              Get Started
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
