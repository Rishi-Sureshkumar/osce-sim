/** Tiny in-page router for the artifact build: routes live in the hash as `#/path`. */
type Listener = () => void;
const listeners = new Set<Listener>();
let current = readHash() ?? "/";
let refreshTick = 0;

function readHash(): string | null {
  const h = window.location.hash;
  return h.startsWith("#/") ? h.slice(1) : null;
}

window.addEventListener("hashchange", () => {
  const next = readHash();
  // `#a-…` in-page anchors (timeline links) keep the current route.
  if (next !== null && next !== current) {
    current = next;
    emit();
  }
});

function emit() {
  for (const l of listeners) l();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export const snapshot = () => `${current}|${refreshTick}`;
export const currentPath = () => current;

export function navigate(path: string) {
  current = path;
  window.location.hash = path;
  window.scrollTo(0, 0);
  emit();
}
export function refresh() {
  refreshTick++;
  emit();
}
