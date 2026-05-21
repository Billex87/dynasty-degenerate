import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import NotFound from "@/pages/NotFound";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const ReportComponentShowcase = lazy(() => import("./pages/ReportComponentShowcase"));
const LoaderKitPreview = lazy(() => import("./pages/LoaderKitPreview"));
const LOCAL_TELEMETRY_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function shouldRenderVercelTelemetry() {
  if (!import.meta.env.PROD || typeof window === "undefined") return false;
  return !LOCAL_TELEMETRY_HOSTS.has(window.location.hostname);
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/components"}>
        <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100" />}>
          <ReportComponentShowcase />
        </Suspense>
      </Route>
      <Route path={"/loader-kit-preview"}>
        <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100" />}>
          <LoaderKitPreview />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const renderVercelTelemetry = shouldRenderVercelTelemetry();

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Router />
          <Toaster position="top-center" richColors />
          {renderVercelTelemetry && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
