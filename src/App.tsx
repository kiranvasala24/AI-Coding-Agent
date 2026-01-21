import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DiagnosticsBanner } from "@/components/DiagnosticsBanner";
import { getFailedDiagnostics } from "@/lib/diagnostics";
import Index from "./pages/Index";
import Health from "./pages/Health";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [diagnosticFailures, setDiagnosticFailures] = useState<Array<{
    category: string;
    check: string;
    status: "pass" | "warn" | "fail";
    message: string;
  }>>([]);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (import.meta.env.DEV) {
      // Check after a brief delay to ensure CSS is loaded
      const timer = setTimeout(() => {
        const failures = getFailedDiagnostics();
        if (failures.length > 0) {
          setDiagnosticFailures(failures);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {import.meta.env.DEV && showBanner && (
            <DiagnosticsBanner 
              failures={diagnosticFailures} 
              onDismiss={() => setShowBanner(false)} 
            />
          )}
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/health" element={<Health />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
