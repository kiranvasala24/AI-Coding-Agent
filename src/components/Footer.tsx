import { Bot, Github, Twitter, Linkedin } from "lucide-react";
import { BuildInfo } from "./BuildInfo";

export function Footer() {
  return (
    <footer className="py-12 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold">
              <span className="text-foreground">Code</span>
              <span className="text-primary">Agent</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Documentation</a>
            <a href="#" className="hover:text-foreground transition-colors">GitHub</a>
            <a href="#" className="hover:text-foreground transition-colors">API Reference</a>
            <a href="#" className="hover:text-foreground transition-colors">Changelog</a>
          </div>

          {/* Social */}
          <div className="flex items-center gap-4">
            <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Github className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </a>
            <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </a>
            <a href="#" className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Built for the Anthropic hiring process. Demonstrating agentic orchestration, 
            real LLM tool-use, and safety-first design.
          </p>
          <BuildInfo />
        </div>
      </div>
    </footer>
  );
}
