declare module "artifact:routes" {
  type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response;
  export const routes: { pattern: string; mod: Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", Handler>> }[];
}
declare module "artifact:assets" {
  export const assets: Record<string, { type: string; base64: string }>;
}
