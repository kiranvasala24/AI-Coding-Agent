import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  className?: string;
  showLineNumbers?: boolean;
}

export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(
  function CodeBlock({ code, language = "typescript", title, className, showLineNumbers = true }, ref) {
  const lines = code.split("\n");

  const highlightSyntax = (line: string) => {
    // Simple syntax highlighting
    return line
      .replace(/(\/\/.*)/g, '<span class="text-muted-foreground">$1</span>')
      .replace(/(".*?")/g, '<span class="text-terminal-green">$1</span>')
      .replace(/('.*?')/g, '<span class="text-terminal-green">$1</span>')
      .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|type|interface)\b/g, '<span class="text-terminal-purple">$1</span>')
      .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-terminal-yellow">$1</span>')
      .replace(/(\{|\}|\[|\]|\(|\))/g, '<span class="text-muted-foreground">$1</span>');
  };

  return (
    <div ref={ref} className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-terminal-border">
          <span className="text-xs text-muted-foreground font-mono">{title}</span>
          <span className="text-xs text-muted-foreground/60 font-mono">{language}</span>
        </div>
      )}
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-sm">
          {lines.map((line, index) => (
            <div key={index} className="flex">
              {showLineNumbers && (
                <span className="select-none pr-4 text-muted-foreground/40 text-right w-8">
                  {index + 1}
                </span>
              )}
              <code 
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: highlightSyntax(line) || "&nbsp;" }}
              />
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
});
