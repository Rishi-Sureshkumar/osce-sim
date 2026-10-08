"use client";
/**
 * QA runtime (only active when the server runs with QA_HOOKS=true — Playwright sets it).
 *
 * - `?qa=fast`   camera tweens, door/knock delays and perform-step animations run instantly.
 * - `?qa=freeze` idle motion (breathing, blink, sway, head turn) is frozen at t = 0 so screenshots
 *                are byte-stable.
 * Components write their "settled" state here; TestHook exposes it as `window.__osce3d.settled`.
 * Nothing here changes behaviour when QA is off.
 */
export interface ProbeHit {
  name: string;
  /** body | hair | eye | gown:<zone> | drape | bed | prop */
  kind: string;
  /** body part (QA label from the asset build), when the hit is on the patient */
  part: string | null;
  point: [number, number, number];
  distance: number;
}

export interface PointerRecord {
  /** what the pointer event's ray hit, in order (as r3f delivered it to the patient) */
  hits: ProbeHit[];
  /** what Patient3D resolved */
  bodyHit: { point: [number, number, number]; kind: string; regionId: string | null } | null;
  /** what the tool logic decided (region, distance, outcome, maneuver) */
  decision?: Record<string, unknown>;
  at: number;
}

export const QA = {
  enabled: false,
  fast: false,
  freeze: false,
  cameraSettled: true,
  directorSettled: true,
  /** proxy bake key the patient wants vs the one it last baked */
  wantKey: "",
  bakedKey: "",
  gownSettled: true,
  busy: false,
  lastPointer: null as PointerRecord | null,
};

export function configureQa(enabled: boolean) {
  QA.enabled = enabled;
  if (!enabled || typeof window === "undefined") {
    QA.fast = false;
    QA.freeze = false;
    return;
  }
  const q = new URLSearchParams(window.location.search).get("qa") ?? "";
  QA.fast = /fast/.test(q);
  QA.freeze = /freeze/.test(q);
}

/** A UI delay, or 0 in fast mode. */
export const qaDelay = (ms: number) => (QA.enabled && QA.fast ? 0 : ms);

export function qaSettled(): boolean {
  return QA.cameraSettled && QA.directorSettled && QA.gownSettled && QA.bakedKey === QA.wantKey && !QA.busy;
}

export function recordPointer(r: Omit<PointerRecord, "at">) {
  if (!QA.enabled) return;
  QA.lastPointer = { ...r, at: performance.now() };
}

export function recordDecision(d: Record<string, unknown>) {
  if (!QA.enabled || !QA.lastPointer) return;
  QA.lastPointer = { ...QA.lastPointer, decision: d };
}
