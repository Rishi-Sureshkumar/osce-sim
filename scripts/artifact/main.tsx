/**
 * Browser-only entry for the claude.ai artifact build (scripts/artifact/build.ts).
 *
 * The real route handlers and page functions from src/app run inside the page: a fetch shim routes
 * `/api/*` to the handlers, a hash router renders the page functions, and the store is in memory
 * (mirrored to localStorage). AI_MOCK is forced on. This is a demo build only: because everything
 * runs client-side, the whole case bundle is in the page (invariant 9 holds only for the server app).
 */
import { Component, StrictMode, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { ASSETS } from "virtual:assets";
import { SafetyBanner } from "@/components/common/SafetyBanner";
import ErrorPage from "@/app/error";
import Link from "./shims/next-link";
import { NotFoundError } from "./shims/next-navigation";
import { currentPath, navigate, snapshot, subscribe } from "./shims/router";

import HomePage from "@/app/page";
import GatePage from "@/app/gate/page";
import StationPage from "@/app/station/[id]/page";
import ResultsPage from "@/app/results/[id]/page";
import CoachHome from "@/app/coach/page";
import CoachSession from "@/app/coach/[id]/page";
import FeedbackList from "@/app/coach/feedback/page";

import * as apiSessions from "@/app/api/sessions/route";
import * as apiActions from "@/app/api/sessions/[id]/actions/route";
import * as apiChat from "@/app/api/sessions/[id]/chat/route";
import * as apiFinish from "@/app/api/sessions/[id]/finish/route";
import * as apiGrade from "@/app/api/sessions/[id]/grade/route";
import * as apiHint from "@/app/api/sessions/[id]/hint/route";
import * as apiListen from "@/app/api/sessions/[id]/listen/route";
import * as apiPen from "@/app/api/sessions/[id]/pen/route";
import * as apiProgress from "@/app/api/sessions/[id]/progress/route";
import * as apiTick from "@/app/api/sessions/[id]/tick/route";
import * as apiOverrides from "@/app/api/coach/sessions/[id]/overrides/route";
import * as apiRegrade from "@/app/api/coach/sessions/[id]/regrade/route";
import * as apiFeedback from "@/app/api/feedback/route";
import * as apiGate from "@/app/api/gate/route";

// ---------- API: fetch shim ----------

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response> | Response;
type RouteModule = Partial<Record<"GET" | "POST" | "PUT" | "DELETE", Handler>>;

const API: [RegExp, RouteModule][] = [
  [/^\/api\/sessions$/, apiSessions],
  [/^\/api\/sessions\/(?<id>[^/]+)\/actions$/, apiActions],
  [/^\/api\/sessions\/(?<id>[^/]+)\/chat$/, apiChat],
  [/^\/api\/sessions\/(?<id>[^/]+)\/finish$/, apiFinish],
  [/^\/api\/sessions\/(?<id>[^/]+)\/grade$/, apiGrade],
  [/^\/api\/sessions\/(?<id>[^/]+)\/hint$/, apiHint],
  [/^\/api\/sessions\/(?<id>[^/]+)\/listen$/, apiListen],
  [/^\/api\/sessions\/(?<id>[^/]+)\/pen$/, apiPen],
  [/^\/api\/sessions\/(?<id>[^/]+)\/progress$/, apiProgress],
  [/^\/api\/sessions\/(?<id>[^/]+)\/tick$/, apiTick],
  [/^\/api\/coach\/sessions\/(?<id>[^/]+)\/overrides$/, apiOverrides],
  [/^\/api\/coach\/sessions\/(?<id>[^/]+)\/regrade$/, apiRegrade],
  [/^\/api\/feedback$/, apiFeedback as RouteModule],
  [/^\/api\/gate$/, apiGate as RouteModule],
];

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.href);
  const local = raw.startsWith("/") || url.host === window.location.host;
  if (local) {
    const asset = Object.entries(ASSETS).find(([p]) => url.pathname.endsWith(p));
    if (asset) {
      const [, { type, b64 }] = asset;
      return new Response(decode(b64) as BodyInit, { status: 200, headers: { "content-type": type } });
    }
    const path = url.pathname.replace(/^.*?(?=\/api\/)/, "");
    for (const [re, mod] of API) {
      const m = re.exec(path);
      if (!m) continue;
      const req = new Request(new URL(path + url.search, "https://osce.local"), {
        method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        headers: init?.headers ?? (input instanceof Request ? input.headers : undefined),
        body: init?.body ?? (input instanceof Request ? await input.text() : undefined),
      });
      const handler = mod[req.method as keyof RouteModule];
      if (!handler) return Response.json({ error: "Method not allowed" }, { status: 405 });
      return handler(req, { params: Promise.resolve({ id: "", ...m.groups }) });
    }
  }
  return realFetch(input, init);
};

// Root-relative links (<Link>, plain <a href="/…">) become in-page navigation.
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a");
  const href = a?.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//") || a?.target === "_blank") return;
  e.preventDefault();
  navigate(href);
});

// ---------- Pages ----------

type PageFn = (props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;

const PAGES: [RegExp, PageFn][] = [
  [/^\/$/, HomePage as PageFn],
  [/^\/gate$/, GatePage as PageFn],
  [/^\/station\/(?<id>[^/]+)$/, StationPage as PageFn],
  [/^\/results\/(?<id>[^/]+)$/, ResultsPage as PageFn],
  [/^\/coach$/, CoachHome as PageFn],
  [/^\/coach\/feedback$/, FeedbackList as PageFn],
  [/^\/coach\/(?<id>[^/]+)$/, CoachSession as PageFn],
];

function NotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link href="/" className="text-cyan-700 underline">
        Back to the stations
      </Link>
    </main>
  );
}

type PageState = { key: string; node: ReactNode } | { key: string; error: Error };

function Page() {
  const key = useSyncExternalStore(subscribe, snapshot);
  const [state, setState] = useState<PageState | null>(null);

  useEffect(() => {
    let live = true;
    const full = currentPath();
    const [path = "/", query = ""] = full.split("?");
    const hit = PAGES.map(([re, fn]) => [re.exec(path), fn] as const).find(([m]) => m);
    (async () => {
      if (!hit) return <NotFound />;
      const [m, fn] = hit;
      try {
        return await fn({ params: Promise.resolve({ id: "", ...m!.groups }), searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) });
      } catch (e) {
        if (e instanceof NotFoundError) return <NotFound />;
        throw e;
      }
    })().then(
      (node) => live && setState({ key, node }),
      (error: unknown) => live && setState({ key, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [key]);

  if (!state) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if ("error" in state) return <ErrorPage error={state.error} reset={() => navigate(currentPath())} />;
  return (
    <Boundary key={state.key.split("|")[0]}>
      {state.node}
    </Boundary>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <ErrorPage error={this.state.error} reset={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

function App() {
  return (
    <>
      <SafetyBanner />
      <p className="bg-slate-800 px-4 py-1 text-center text-xs text-slate-200">
        Demo build: runs entirely in your browser with mock AI. Sessions stay in this browser only.{" "}
        <Link href="/coach" className="underline">
          Coach view
        </Link>
      </p>
      <Page />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
