import { cn } from "@/lib/utils";

interface DiffLine {
  type: "added" | "removed" | "context" | "header";
  content: string;
  lineNumber?: { old?: number; new?: number };
}

interface DiffViewerProps {
  title: string;
  lines: DiffLine[];
  className?: string;
}

export function DiffViewer({ title, lines, className }: DiffViewerProps) {
  const getLineStyles = (type: DiffLine["type"]) => {
    switch (type) {
      case "added":
        return "bg-terminal-green/10 text-terminal-green";
      case "removed":
        return "bg-terminal-red/10 text-terminal-red";
      case "header":
        return "bg-terminal-cyan/10 text-terminal-cyan";
      default:
        return "text-muted-foreground";
    }
  };

  const getPrefix = (type: DiffLine["type"]) => {
    switch (type) {
      case "added":
        return "+";
      case "removed":
        return "-";
      case "header":
        return "@@";
      default:
        return " ";
    }
  };

  return (
    <div className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-terminal-border">
        <span className="text-xs text-foreground font-mono">{title}</span>
        <span className="text-xs text-muted-foreground font-mono">unified diff</span>
      </div>
      <div className="p-0 overflow-x-auto font-mono text-sm">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex px-4 py-0.5",
              getLineStyles(line.type)
            )}
          >
            <span className="select-none w-12 text-muted-foreground/40 text-right pr-4">
              {line.lineNumber?.old || ""}
            </span>
            <span className="select-none w-12 text-muted-foreground/40 text-right pr-4">
              {line.lineNumber?.new || ""}
            </span>
            <span className="w-4 select-none">{getPrefix(line.type)}</span>
            <span className="flex-1 whitespace-pre">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
