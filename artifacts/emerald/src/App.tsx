import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { ContactProvider } from "@/components/ContactContext";
import { LLMProvider } from "@/llm/LLMProvider";
import Home from "@/pages/Home";
import About from "@/pages/About";
import OpenClaw from "@/pages/OpenClaw";
import PersonaPage from "@/pages/PersonaPage";
import DemoHolding from "@/pages/DemoHolding";
import BlockstreamDemo from "@/pages/BlockstreamDemo";
import PersonaDemoShell from "@/pages/PersonaDemoShell";
import TicketPreview from "@/pages/TicketPreview";
import HowItWorks from "@/pages/HowItWorks";
import Changelog from "@/pages/Changelog";
import Proof from "@/pages/Proof";
import Compliance from "@/pages/Compliance";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Support-ticket preview screen. Reachable from the chat
          widget's settings menu on every persona demo. Renders
          outside the Greater Layout so it reads as a standalone
          helpdesk-shaped artifact. Registered before the more
          general /demo/:slug route so wouter resolves it correctly. */}
      <Route path="/demo/:slug/ticket" component={TicketPreview} />

      {/* Live Blockstream (FinTech) demo — bespoke chrome preserved
          as the original Emerald portfolio piece. Renders without the
          Greater Layout chrome to keep the Blockstream-branded support
          page authentic. Other personas use the generic shell below. */}
      <Route path="/demo/blockstream" component={BlockstreamDemo} />

      {/* Live demos for the five non-FinTech personas. Each renders a
          mock host page configured by the persona's `scenario.shell`,
          a per-persona welcome + placeholder, and triggers loading of
          its seed bundle. Renders outside the Greater Layout so the
          mock host page reads as its own site. The DemoHolding screen
          is now only used as a fallback when a persona has no
          scenario configured (e.g. during local development). */}
      <Route path="/demo/startups" component={PersonaDemoShell} />
      <Route path="/demo/faith" component={PersonaDemoShell} />
      <Route path="/demo/schools" component={PersonaDemoShell} />
      <Route path="/demo/small-business" component={PersonaDemoShell} />
      <Route path="/demo/healthtech" component={PersonaDemoShell} />

      {/* Greater shell routes — wrapped in Layout (nav + footer + bottom
          mobile nav + AnimatePresence page transitions). */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/about" component={About} />
            <Route path="/how-it-works" component={HowItWorks} />
            <Route path="/proof" component={Proof} />
            <Route path="/changelog" component={Changelog} />
            <Route path="/compliance" component={Compliance} />
            <Route path="/openclaw" component={OpenClaw} />
            <Route path="/bots/:slug" component={PersonaPage} />
            <Route path="/demo/:slug" component={DemoHolding} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* LLMProvider sits ABOVE the router so SPA navigations never
          re-trigger model download. The worker, the readiness state,
          and the IndexedDB-cached vector index all persist for the
          whole SPA session. */}
      <LLMProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ContactProvider>
            <Router />
          </ContactProvider>
        </WouterRouter>
      </LLMProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
