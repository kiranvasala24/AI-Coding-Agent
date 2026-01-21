import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TerminalLine {
  type: "command" | "output" | "success" | "error" | "info";
  content: string;
  delay?: number;
}

interface TerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  lines: TerminalLine[];
  title?: string;
  autoPlay?: boolean;
}

export const Terminal = React.forwardRef<HTMLDivElement, TerminalProps>(
  function Terminal({ lines, title = "terminal", className, autoPlay = true, ...props }, ref) {
    const [visibleLines, setVisibleLines] = useState<number>(0);
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
      if (!autoPlay) {
        setVisibleLines(lines.length);
        return;
      }

      let currentLine = 0;
      const showNextLine = () => {
        if (currentLine < lines.length) {
          setIsTyping(true);
          setTimeout(() => {
            setVisibleLines(currentLine + 1);
            setIsTyping(false);
            currentLine++;
            setTimeout(showNextLine, lines[currentLine - 1]?.delay || 800);
          }, 300);
        }
      };

      const timeout = setTimeout(showNextLine, 500);
      return () => clearTimeout(timeout);
    }, [lines, autoPlay]);

    const getLineColor = (type: TerminalLine["type"]) => {
      switch (type) {
        case "command":
          return "text-foreground";
        case "success":
          return "text-terminal-green";
        case "error":
          return "text-terminal-red";
        case "info":
          return "text-terminal-cyan";
        default:
          return "text-muted-foreground";
      }
    };

    return (
      <div 
        ref={ref}
        className={cn("rounded-lg border border-terminal-border bg-terminal-bg overflow-hidden shadow-2xl", className)}
        {...props}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-terminal-border">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-terminal-red/80" />
            <div className="w-3 h-3 rounded-full bg-terminal-yellow/80" />
            <div className="w-3 h-3 rounded-full bg-terminal-green/80" />
          </div>
          <span className="ml-4 text-xs text-muted-foreground font-mono truncate">{title}</span>
        </div>

        {/* Terminal content */}
        <div className="p-4 font-mono text-sm min-h-[200px] overflow-x-auto">
          {lines.slice(0, visibleLines).map((line, index) => (
            <div key={index} className={cn("mb-1 break-words", getLineColor(line.type))}>
              {line.type === "command" && (
                <span className="text-terminal-cyan mr-2">❯</span>
              )}
              {line.content}
            </div>
          ))}
          {isTyping && (
            <span className="inline-block w-2 h-4 bg-terminal-green animate-terminal-blink" />
          )}
          {!isTyping && visibleLines === lines.length && (
            <div className="flex items-center mt-2">
              <span className="text-terminal-cyan mr-2">❯</span>
              <span className="inline-block w-2 h-4 bg-terminal-green animate-terminal-blink" />
            </div>
          )}
        </div>
      </div>
    );
  }
);

Terminal.displayName = "Terminal";
