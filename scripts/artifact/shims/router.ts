/** A memory router standing in for Next's App Router inside the artifact frame. */
type Listener = () => void;
const KEY = "osce-sim-artifact-path";

function initial(): string {
  try {
    return sessionStorage.getItem(KEY) || "/";
  } catch {
    return "/";
  }
}

let path = initial();
let version = 0;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const routerState = {
  get path() {
    return path;
  },
  get version() {
    return version;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  snapshot: () => `${path}|${version}`,
};

export function navigate(href: string) {
  path = href.split("#")[0] || "/";
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // ignore
  }
  window.scrollTo(0, 0);
  emit();
}

export function refresh() {
  version++;
  emit();
}
