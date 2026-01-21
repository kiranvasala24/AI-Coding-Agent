import { Navbar } from "@/components/Navbar";
import { HeroSection } from "@/components/HeroSection";
import { WorkflowSection } from "@/components/WorkflowSection";
import { FeaturesSection } from "@/components/FeaturesSection";
import { PhasesSection } from "@/components/PhasesSection";
import { DemoSection } from "@/components/DemoSection";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background noise">
      <Navbar />
      <main>
        <HeroSection />
        <WorkflowSection />
        <FeaturesSection />
        <PhasesSection />
        <DemoSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
