import { FeatureGrid } from "@/components/FeatureGrid";

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built for <span className="text-gradient">Production</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enterprise-grade features designed for large codebases, team workflows,
            and strict safety requirements.
          </p>
        </div>

        <FeatureGrid />
      </div>
    </section>
  );
}
