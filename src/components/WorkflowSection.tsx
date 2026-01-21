import { WorkflowDiagram } from "@/components/WorkflowDiagram";

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Trust-First <span className="text-gradient">Workflow</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every code change follows a strict pipeline: plan, execute, verify, and approve.
            Nothing touches your codebase without your explicit consent.
          </p>
        </div>

        <WorkflowDiagram />

        <div className="mt-16 grid md:grid-cols-3 gap-8 text-center">
          <div className="p-6 rounded-xl bg-card/50 border border-border">
            <div className="text-3xl font-bold text-primary mb-2">100%</div>
            <div className="text-sm text-muted-foreground">Changes require approval</div>
          </div>
          <div className="p-6 rounded-xl bg-card/50 border border-border">
            <div className="text-3xl font-bold text-success mb-2">Sandboxed</div>
            <div className="text-sm text-muted-foreground">Tests run in Docker isolation</div>
          </div>
          <div className="p-6 rounded-xl bg-card/50 border border-border">
            <div className="text-3xl font-bold text-warning mb-2">Auditable</div>
            <div className="text-sm text-muted-foreground">Full reasoning trail logged</div>
          </div>
        </div>
      </div>
    </section>
  );
}
