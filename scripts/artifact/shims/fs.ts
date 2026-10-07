/** In-memory stand-in for node:fs, enough for FileRepo. Persists to localStorage when the browser allows it. */
const KEY = "osce-sim-artifact-fs";
const files = new Map<string, string>(load());

function load(): [string, string][] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as [string, string][]) : [];
  } catch {
    return [];
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...files]));
  } catch {
    // storage blocked or full: keep working in memory
  }
}

export function resetStore() {
  files.clear();
  save();
}

const fs = {
  existsSync: (p: string) => files.has(p),
  readFileSync: (p: string) => {
    const v = files.get(p);
    if (v === undefined) throw new Error(`ENOENT: ${p}`);
    return v;
  },
  writeFileSync: (p: string, data: string) => {
    files.set(p, data);
  },
  renameSync: (from: string, to: string) => {
    const v = files.get(from);
    if (v === undefined) throw new Error(`ENOENT: ${from}`);
    files.delete(from);
    files.set(to, v);
    save();
  },
  mkdirSync: () => undefined,
  readdirSync: () => [] as string[],
};
export default fs;
