/**
 * Stands in for the Next server inside the artifact: same-origin /api/* requests go to the real
 * route handlers (bundled into the page), and /models, /audio files come from embedded data.
 */
import { routes } from "artifact:routes";
import { assets } from "artifact:assets";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function match(pattern: string, pathname: string): Record<string, string> | null {
  const a = pattern.split("/");
  const b = pathname.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const seg = a[i]!;
    const dyn = /^\[(\w+)\]$/.exec(seg);
    if (dyn) params[dyn[1]!] = decodeURIComponent(b[i]!);
    else if (seg !== b[i]) return null;
  }
  return params;
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function installFetchShim() {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const local = raw.startsWith("/") && !raw.startsWith("//");
    const url = new URL(raw, local ? "http://osce.local" : location.href);
    if (!local && url.host !== location.host) return original(input, init);

    const asset = assets[url.pathname];
    if (asset) return new Response(decode(asset.base64) as BlobPart, { headers: { "content-type": asset.type } });

    if (url.pathname.startsWith("/api/")) {
      const base = input instanceof Request ? input : undefined;
      const req = new Request(new URL(url.pathname + url.search, "http://osce.local"), base ? new Request(base, init) : init);
      for (const r of routes) {
        const params = match(r.pattern, url.pathname);
        if (!params) continue;
        const handler = r.mod[req.method as Method];
        if (!handler) return Response.json({ error: "Method not allowed" }, { status: 405 });
        return handler(req, { params: Promise.resolve(params) });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return original(input, init);
  };
}
