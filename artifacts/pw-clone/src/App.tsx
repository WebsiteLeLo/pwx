import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { LoadingBar } from "@/components/loading-bar";
import DevToolsBlocked from "@/pages/devtools-blocked";

// Pages
import Home from "@/pages/home";
import Batch from "@/pages/batch";
import Subject from "@/pages/subject";
import Topic from "@/pages/topic";
import Watch from "@/pages/watch";
import ScheduleWatch from "@/pages/schedule-watch";
import Materials from "@/pages/materials";
import Schedule from "@/pages/schedule";
import { MyMixList, MyMixDetail } from "@/pages/my-mix";
import DppQuiz from "@/pages/dpp-quiz";
import BatchCalendar from "@/pages/batch-calendar";
import NotFound from "@/pages/not-found";
import AiGirl from "@/components/ai-girl/AiGirl";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 60,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  const [location] = useLocation();
  const isHome = location === "/" || location === "";

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="contents"
        >
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/batch/:batchId" component={Batch} />
            <Route path="/batch/:batchId/subject/:subjectId" component={Subject} />
            <Route path="/batch/:batchId/subject/:subjectId/topic/:topicId" component={Topic} />
            <Route path="/batch/:batchId/calendar" component={BatchCalendar} />
            <Route path="/watch" component={Watch} />
            <Route path="/schedule-watch" component={ScheduleWatch} />
            <Route path="/materials" component={Materials} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/my-mix" component={MyMixList} />
            <Route path="/my-mix/:mixId" component={MyMixDetail} />
            <Route path="/dpp-quiz" component={DppQuiz} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
      {/* Aria available on all pages */}
      <AiGirl />
    </>
  );
}

function App() {
  const [dtState, setDtState] = useState<{ detected: boolean; strikes: number }>({
    detected: false,
    strikes: 0,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const { strikes } = (e as CustomEvent<{ strikes: number }>).detail;
      setDtState({ detected: true, strikes });
    };
    window.addEventListener("pwx-devtools-open", handler);
    return () => window.removeEventListener("pwx-devtools-open", handler);
  }, []);

  const dismiss = () => setDtState((s) => ({ ...s, detected: false }));

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LoadingBar />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
        {dtState.detected && (
          <DevToolsBlocked strikes={dtState.strikes} onDismiss={dismiss} />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
