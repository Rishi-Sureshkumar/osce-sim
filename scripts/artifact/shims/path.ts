const norm = (parts: string[]) => {
  const out: string[] = [];
  for (const s of parts.join("/").split("/")) {
    if (!s || s === ".") continue;
    if (s === "..") out.pop();
    else out.push(s);
  }
  return "/" + out.join("/");
};
const path = {
  sep: "/",
  join: (...p: string[]) => norm(p),
  dirname: (p: string) => p.replace(/\/[^/]*$/, "") || "/",
  relative: (_from: string, to: string) => to,
};
export default path;
