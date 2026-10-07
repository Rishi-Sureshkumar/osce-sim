import { navigate, refresh, routerState } from "./router";

export class NotFoundError extends Error {
  constructor() {
    super("This page could not be found.");
  }
}

export function notFound(): never {
  throw new NotFoundError();
}

export function redirect(href: string): never {
  navigate(href);
  throw new Error(`Redirected to ${href}`);
}

const router = { push: navigate, replace: navigate, refresh, back: () => navigate("/"), forward: () => undefined, prefetch: () => undefined };
export function useRouter() {
  return router;
}
export function usePathname() {
  return routerState.path.split("?")[0];
}
export function useSearchParams() {
  return new URLSearchParams(routerState.path.split("?")[1] ?? "");
}
