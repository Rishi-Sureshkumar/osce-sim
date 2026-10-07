import { currentPath, navigate, refresh } from "./router";

export class NotFoundError extends Error {
  constructor() {
    super("Not found");
  }
}

export function notFound(): never {
  throw new NotFoundError();
}
export function redirect(path: string): never {
  navigate(path);
  throw new NotFoundError();
}
export function useRouter() {
  return { push: navigate, replace: navigate, refresh, back: () => history.back(), forward: () => history.forward(), prefetch: () => {} };
}
export const usePathname = () => currentPath().split("?")[0];
export const useSearchParams = () => new URLSearchParams(currentPath().split("?")[1] ?? "");
