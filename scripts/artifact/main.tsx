import "./shims/env";
import { Component, StrictMode, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { installFetchShim } from "./fetchShim";
import { routerState, navigate, refresh } from "./shims/router";
import { NotFoundError } from "./shims/next-navigation";
import { resetStore } from "./shims/fs";
import { SafetyBanner } from "@/components/common/SafetyBanner";
import ErrorPage from "@/app/error";
import Home from "@/app/page";
import StationPage from "@/app/station/[id]/page";
import ResultsPage from "@/app/results/[id]/page";
import CoachHome from "@/app/coach/page";
import CoachSession from "@/app/coach/[id]/page";
import CoachFeedback from "@/app/coach/feedback/page";

installFetchShim();

type Page = (props: { params: Promise<Record<string, string>>; searchParams: Promise<Record<string, string>> }) => ReactNode | Promise<ReactNode>;

const PAGES: [RegExp, Page][] = [
  [/^\/$/, Home as Page],
  [/^\/station\/(?<id>[^/]+)$/, StationPage as unknown as Page],
  [/^\/results\/(?<id>[^/]+)$/, ResultsPage as unknown as Page],
  [/^\/coach$/, CoachHome as unknown as Page],
  [/^\/coach\/feedback$/, CoachFeedback as unknown as Page],
  [/^\/coach\/(?<id>[^/]+)$/, CoachSession as unknown as Page],
];

/** Server pages are plain (async) functions: call them here and render what they return. */
async function renderPath(path: string): Promise<ReactNode> {
  const [pathname = "/", query = ""] = path.split("?");
  for (const [re, page] of PAGES) {
    const m = re.exec(pathname);
    if (!m) continue;
    return page({ params: Promise.resolve({ ...m.groups }), searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) });
  }
  throw new NotFoundError();
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-6">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <button type="button" className="text-sm text-cyan-700 underline" onClick={() => navigate("/")}>
        Back to the case list
      </button>
    </main>
  );
}

class Boundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (error instanceof NotFoundError) return <NotFound />;
    return <ErrorPage error={error} reset={() => this.setState({ error: null }, refresh)} />;
  }
}

function Router() {
  useSyncExternalStore(routerState.subscribe, routerState.snapshot);
  const { path, version } = routerState;
  const [view, setView] = useState<{ path: string; node: ReactNode } | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);

  useEffect(() => {
    let live = true;
    renderPath(path).then(
      (node) => {
        if (!live) return;
        setFailure(null);
        setView({ path, node });
      },
      (e: unknown) => {
        if (live) setFailure(e instanceof Error ? e : new Error(String(e)));
      },
    );
    return () => {
      live = false;
    };
  }, [path, version]);

  if (failure) return failure instanceof NotFoundError ? <NotFound /> : <ErrorPage error={failure} reset={refresh} />;
  if (!view || view.path !== path) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  return (
    <Boundary resetKey={path} key={path}>
      {view.node}
    </Boundary>
  );
}

function DemoBar() {
  useSyncExternalStore(routerState.subscribe, routerState.snapshot);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-800">Demo build</span>
      <span>Mock AI patient and grader. Sessions are saved in this browser only.</span>
      <span className="ml-auto flex gap-3">
        <button type="button" className="text-cyan-700 underline" onClick={() => navigate("/")}>
          Cases
        </button>
        <button type="button" className="text-cyan-700 underline" onClick={() => navigate("/coach")}>
          Coach view
        </button>
        <button
          type="button"
          className="text-cyan-700 underline"
          onClick={() => {
            resetStore();
            location.reload();
          }}
        >
          Clear saved sessions
        </button>
      </span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoBar />
    <SafetyBanner />
    <Router />
  </StrictMode>,
);
