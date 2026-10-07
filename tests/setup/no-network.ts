/**
 * Phase 4: the app needs no external service. Any test that tries to reach a non-local host fails
 * loudly (fetch, http(s).request and sockets), so a hidden network dependency can't creep back in.
 */
import http from "node:http";
import https from "node:https";
import net from "node:net";

const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\])$/;
// the optional Postgres repo test may point at a database host
const dbHost = (() => {
  try {
    return process.env.TEST_DATABASE_URL ? new URL(process.env.TEST_DATABASE_URL).hostname : null;
  } catch {
    return null;
  }
})();
const LOCAL = { test: (h: string) => LOOPBACK.test(h) || h === dbHost };

function refuse(host: string): never {
  throw new Error(`[no-network] tests must not reach external hosts (tried ${host})`);
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!LOCAL.test(url.hostname)) refuse(url.hostname);
  return realFetch(input, init);
}) as typeof fetch;

function hostOf(a: unknown): string {
  if (typeof a === "string" || a instanceof URL) return new URL(String(a)).hostname;
  const o = a as { hostname?: string; host?: string } | undefined;
  return o?.hostname ?? o?.host ?? "localhost";
}

for (const mod of [http, https]) {
  const real = mod.request;
  (mod as { request: unknown }).request = (...args: unknown[]) => {
    const host = hostOf(args[0]);
    if (!LOCAL.test(host)) refuse(host);
    return (real as (...x: unknown[]) => unknown)(...args);
  };
}

const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  const o = args[0];
  const host = typeof o === "object" && o ? ((o as { path?: string }).path ? "localhost" : ((o as { host?: string }).host ?? "localhost")) : typeof args[1] === "string" ? args[1] : "localhost";
  if (!LOCAL.test(host)) refuse(host);
  return (realConnect as (...x: unknown[]) => net.Socket).apply(this, args);
} as typeof net.Socket.prototype.connect;
