/** Runs first: the server modules read process.env / process.cwd() at call time. */
const env: Record<string, string | undefined> = {
  AI_MOCK: "true",
  FILE_STORE_PATH: "/store/store.json",
};
(globalThis as unknown as { process: unknown }).process = { env, cwd: () => "/app", pid: 1 };
export {};
