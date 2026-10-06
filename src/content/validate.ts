import type { Rule } from "@/domain/schemas";
import { Position, CourtesyKind, CourtesyTag, type FindingValue } from "@/domain/schemas";
import { findingValueText } from "@/engine/resolveFinding";
import type { ContentIndex } from "./types";

const VITAL_KEYS = ["hr", "rr", "bpSystolic", "bpDiastolic", "tempC", "spo2", "spo2Context"];

/** Cross-file checks the per-file Zod schemas can't do. Returns human-readable errors. */
export function validateContentGraph(c: ContentIndex): string[] {
  const errors: string[] = [];
  const dup = <T extends { id: string }>(kind: string, xs: T[]) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x.id)) errors.push(`duplicate ${kind} id "${x.id}"`);
      seen.add(x.id);
    }
  };
  dup("region", c.regions);
  dup("maneuver", c.maneuvers);
  dup("case", c.cases);
  dup("mark sheet", c.markSheets);

  for (const m of c.maneuvers) {
    for (const r of m.allowedRegions) if (!c.regionById.has(r)) errors.push(`maneuver ${m.id}: unknown region "${r}"`);
    for (const k of Object.keys(m.normalFinding)) {
      if (k !== "default" && !m.allowedRegions.includes(k)) errors.push(`maneuver ${m.id}: normalFinding key "${k}" is not an allowed region`);
    }
    for (const v of Object.values(m.normalFinding)) {
      for (const [, key] of findingValueText(v).matchAll(/\{vitals\.(\w+)\}/g)) {
        if (!VITAL_KEYS.includes(key!)) errors.push(`maneuver ${m.id}: unknown placeholder {vitals.${key}}`);
      }
      errors.push(...findingValueErrors(`maneuver ${m.id}`, v));
    }
    if (m.interaction === "sequence" && !m.steps?.length) errors.push(`maneuver ${m.id}: sequence interaction needs steps`);
    if (m.toolMode && !m.tool) errors.push(`maneuver ${m.id}: toolMode without tool`);
    if (m.sourceText) errors.push(`maneuver ${m.id}: sourceText must stay empty until copyright is cleared`);
  }

  for (const cs of c.cases) {
    for (const [maneuverId, byRegion] of Object.entries(cs.abnormalFindings)) {
      const m = c.maneuverById.get(maneuverId);
      if (!m) {
        errors.push(`case ${cs.id}: abnormal finding for unknown maneuver "${maneuverId}"`);
        continue;
      }
      for (const [regionKey, v] of Object.entries(byRegion)) {
        if (regionKey !== "default" && !m.allowedRegions.includes(regionKey)) {
          errors.push(`case ${cs.id}: ${maneuverId} finding for region "${regionKey}" which the maneuver does not allow`);
        }
        errors.push(...findingValueErrors(`case ${cs.id} ${maneuverId}/${regionKey}`, v));
      }
    }
    for (const id of cs.markSheetIds) if (!c.markSheetById.has(id)) errors.push(`case ${cs.id}: unknown mark sheet "${id}"`);
    for (const [msId, sections] of Object.entries(cs.markSheetSections ?? {})) {
      const ms = c.markSheetById.get(msId);
      if (!ms || !cs.markSheetIds.includes(msId)) {
        errors.push(`case ${cs.id}: markSheetSections refers to "${msId}" which is not in markSheetIds`);
        continue;
      }
      for (const sec of sections) {
        if (!ms.items.some((i) => i.section === sec)) errors.push(`case ${cs.id}: mark sheet ${msId} has no section "${sec}"`);
      }
    }
    // drawn signs must agree with the findings a student would elicit
    for (const e of cs.visibleSigns?.edema ?? []) {
      if (!c.regionById.has(e.regionId)) errors.push(`case ${cs.id}: visibleSigns edema on unknown region "${e.regionId}"`);
      const f = cs.abnormalFindings.edema_assessment;
      if (!f?.[e.regionId] && !f?.default) errors.push(`case ${cs.id}: edema drawn on ${e.regionId} but edema_assessment has no abnormal finding there`);
    }
    if ((cs.visibleSigns?.jvpCm ?? 0) > 3 && !cs.abnormalFindings.jvp_inspection) {
      errors.push(`case ${cs.id}: visibleSigns.jvpCm > 3 but jvp_inspection has no abnormal finding`);
    }
    const factIds = new Set<string>();
    for (const f of cs.history.facts) {
      if (factIds.has(f.id)) errors.push(`case ${cs.id}: duplicate history fact id "${f.id}"`);
      factIds.add(f.id);
    }
  }

  for (const ms of c.markSheets) {
    const ids = new Set<string>();
    for (const item of ms.items) {
      if (ids.has(item.id)) errors.push(`mark sheet ${ms.id}: duplicate item id "${item.id}"`);
      ids.add(item.id);
      if (item.rule) for (const e of ruleRefErrors(item.rule, c)) errors.push(`mark sheet ${ms.id} item ${item.id}: ${e}`);
      if (item.sourceText) errors.push(`mark sheet ${ms.id} item ${item.id}: sourceText must stay empty until copyright is cleared`);
    }
  }
  return errors;
}

function findingValueErrors(where: string, v: FindingValue): string[] {
  if (typeof v === "string" || !v.byPosition) return [];
  return Object.keys(v.byPosition)
    .filter((k) => !Position.safeParse(k).success)
    .map((k) => `${where}: byPosition key "${k}" is not a Position`);
}

function maneuverList(x: string | string[]): string[] {
  return Array.isArray(x) ? x : [x];
}

export function ruleRefErrors(rule: Rule, c: ContentIndex): string[] {
  const out: string[] = [];
  const checkManeuver = (id: string) => {
    if (!c.maneuverById.has(id)) out.push(`unknown maneuver "${id}"`);
  };
  if ("performed" in rule) {
    maneuverList(rule.performed).forEach(checkManeuver);
    for (const r of rule.regions ?? []) {
      if (!c.regionById.has(r)) out.push(`unknown region "${r}"`);
      else if (!maneuverList(rule.performed).some((m) => c.maneuverById.get(m)?.allowedRegions.includes(r))) {
        out.push(`region "${r}" is not allowed for ${maneuverList(rule.performed).join("/")}`);
      }
    }
  } else if ("before" in rule) {
    for (const ref of rule.before) {
      const err = eventRefError(ref, c);
      if (err) out.push(err);
    }
  } else if ("technique" in rule) {
    maneuverList(rule.technique.maneuver).forEach(checkManeuver);
    for (const r of rule.technique.regions ?? []) if (!c.regionById.has(r)) out.push(`unknown region "${r}"`);
  } else if ("performedIn" in rule) {
    maneuverList(rule.performedIn.maneuver).forEach(checkManeuver);
  } else if ("all" in rule) {
    rule.all.forEach((r) => out.push(...ruleRefErrors(r, c)));
  } else if ("any" in rule) {
    rule.any.forEach((r) => out.push(...ruleRefErrors(r, c)));
  } else if ("not" in rule) {
    out.push(...ruleRefErrors(rule.not, c));
  }
  return out;
}

const TYPES = ["examine", "say", "courtesy", "submit_ddx", "note", "state_change", "hint", "room", "touch"];

export function eventRefError(ref: string, c: ContentIndex): string | null {
  const [head, rest] = ref.includes(":") ? [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)] : [ref, ""];
  if (!rest) return CourtesyKind.safeParse(head).success ? null : `unknown event ref "${ref}"`;
  switch (head) {
    case "first":
    case "last":
      return TYPES.includes(rest) ? null : `unknown action type in "${ref}"`;
    case "maneuver":
      return c.maneuverById.has(rest) ? null : `unknown maneuver in "${ref}"`;
    case "position":
      return Position.safeParse(rest).success ? null : `unknown position in "${ref}"`;
    case "tag":
      return CourtesyTag.safeParse(rest).success ? null : `unknown tag in "${ref}"`;
    case "room":
      return ["knock", "enter", "exit"].includes(rest) ? null : `unknown room event in "${ref}"`;
    default:
      return `unknown event ref "${ref}"`;
  }
}
