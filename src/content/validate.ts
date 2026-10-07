import type { Intent, MistakeRule, Rule } from "@/domain/schemas";
import { Position, CourtesyKind, CourtesyTag, DrapeSection, type FindingValue } from "@/domain/schemas";
import { findingValueText } from "@/engine/resolveFinding";
import { sheetsForCase } from "@/engine/sheets";
import type { ContentIndex } from "./types";

const VITAL_KEYS = ["hr", "rr", "bpSystolic", "bpDiastolic", "tempC", "spo2", "spo2Context"];

/** Cross-file checks the per-file Zod schemas can't do. Returns human-readable errors. */
export function validateContentGraph(c: ContentIndex): string[] {
  const topicIds = new Set(c.lang.topics.map((t) => t.id));
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
    for (const st of m.steps ?? []) {
      if (st.logsManeuver && !c.maneuverById.has(st.logsManeuver)) errors.push(`maneuver ${m.id} step ${st.id}: logsManeuver "${st.logsManeuver}" is unknown`);
      if (st.kind === "control" && !st.control) errors.push(`maneuver ${m.id} step ${st.id}: control step needs a control`);
    }
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
    // phase 3: door instructions, PE checklist, PEN key
    for (const pe of cs.doorInstructions?.prohibitedExams ?? []) {
      for (const r of pe.regionIds) if (!c.regionById.has(r)) errors.push(`case ${cs.id}: prohibited exam "${pe.label}" names unknown region "${r}"`);
    }
    const peIds = new Set<string>();
    for (const item of cs.peChecklist ?? []) {
      if (peIds.has(item.id)) errors.push(`case ${cs.id}: duplicate peChecklist item "${item.id}"`);
      peIds.add(item.id);
      if (item.rule) for (const e of ruleRefErrors(item.rule, c)) errors.push(`case ${cs.id} peChecklist ${item.id}: ${e}`);
      if (item.sourceText) errors.push(`case ${cs.id} peChecklist ${item.id}: sourceText must stay empty`);
    }
    for (const k of cs.penKey?.exam ?? []) {
      for (const m of k.maneuverIds) if (!c.maneuverById.has(m)) errors.push(`case ${cs.id}: penKey exam "${k.id}" names unknown maneuver "${m}"`);
    }
    const keyIds = [...(cs.penKey?.history ?? []), ...(cs.penKey?.exam ?? []), ...(cs.penKey?.differential ?? [])].map((k) => k.id);
    if (new Set(keyIds).size !== keyIds.length) errors.push(`case ${cs.id}: penKey ids must be unique across history, exam and differential`);
    if (cs.markSheetIds.every((id) => c.markSheetById.has(id))) {
      // the AI grader returns judgements by item id, so ids must be unique across a case's sheets
      const seen = new Map<string, string>();
      for (const sheet of sheetsForCase(cs, c.markSheetById)) {
        for (const item of sheet.items) {
          const prev = seen.get(item.id);
          if (prev && prev !== sheet.id) errors.push(`case ${cs.id}: item id "${item.id}" appears in both ${prev} and ${sheet.id}`);
          seen.set(item.id, sheet.id);
        }
      }
    }
    const factIds = new Set<string>();
    for (const f of cs.history.facts) {
      if (factIds.has(f.id)) errors.push(`case ${cs.id}: duplicate history fact id "${f.id}"`);
      factIds.add(f.id);
      if (f.intents) errors.push(...intentErrors(`case ${cs.id} fact ${f.id}`, f.intents));
      for (const fu of f.followUps) {
        if (factIds.has(fu.id)) errors.push(`case ${cs.id}: duplicate history id "${fu.id}" (follow-up of ${f.id})`);
        factIds.add(fu.id);
        errors.push(...intentErrors(`case ${cs.id} follow-up ${fu.id}`, fu.intents));
      }
    }
    for (const n of cs.history.pertinentNegatives) {
      if (n.id && factIds.has(n.id)) errors.push(`case ${cs.id}: duplicate history id "${n.id}" (pertinent negative)`);
      if (n.id) factIds.add(n.id);
      if (n.intents) errors.push(...intentErrors(`case ${cs.id} negative ${n.id ?? n.topic}`, n.intents));
    }
    for (const cr of cs.history.conversation) if (cr.intents) errors.push(...intentErrors(`case ${cs.id} conversation ${cr.kind}`, cr.intents));
    // phase 4 (M1): an encounter's history must be askable — every fact and negative has intents, with real topics
    if (cs.mode === "encounter" && topicIds.size) {
      for (const f of cs.history.facts) if (!f.intents) errors.push(`case ${cs.id}: fact "${f.id}" has no intents (how students ask for it)`);
      for (const n of cs.history.pertinentNegatives) if (!n.intents) errors.push(`case ${cs.id}: pertinent negative "${n.id ?? n.topic}" has no intents`);
    }
    const intents = [...cs.history.facts.flatMap((f) => [f.intents, ...f.followUps.map((u) => u.intents)]), ...cs.history.pertinentNegatives.map((n) => n.intents)];
    for (const it of intents) for (const t of it?.topics ?? []) if (topicIds.size && !topicIds.has(t)) errors.push(`case ${cs.id}: intent topic "${t}" is not in content/lang/topics.json`);
    for (const nt of cs.history.notRelevantTopics) if (topicIds.size && !topicIds.has(nt)) errors.push(`case ${cs.id}: notRelevantTopics "${nt}" is not in content/lang/topics.json`);
    // phase 4: acceptable diagnoses earn penKey differential items; case mistake rules
    const ddxIds = new Set((cs.penKey?.differential ?? []).map((d) => d.id));
    for (const ad of cs.acceptableDiagnoses) {
      for (const sat of ad.satisfies) if (!ddxIds.has(sat)) errors.push(`case ${cs.id}: acceptable diagnosis "${ad.id}" satisfies unknown penKey differential "${sat}"`);
    }
    for (const mr of cs.mistakes) errors.push(...mistakeRuleErrors(`case ${cs.id} mistake ${mr.id}`, mr, c));
    const caseItems = new Set(cs.markSheetIds.flatMap((id) => c.markSheets.find((m) => m.id === id)?.items.map((i) => i.id) ?? []));
    for (const na of cs.itemsNotApplicable) if (!caseItems.has(na.itemId)) errors.push(`case ${cs.id}: itemsNotApplicable "${na.itemId}" is not an item of the case's mark sheets`);
  }

  // phase 4 (M1): language banks
  const kinds = new Set<string>();
  for (const r of c.lang.conversation) {
    if (kinds.has(r.kind)) errors.push(`content/lang/conversation.json: kind "${r.kind}" appears twice`);
    kinds.add(r.kind);
    if (r.intents) errors.push(...intentErrors(`conversation ${r.kind}`, r.intents));
  }
  const bankIds = new Set<string>();
  for (const h of c.lang.history) {
    if (bankIds.has(h.id)) errors.push(`content/lang/history-bank.json: duplicate id "${h.id}"`);
    bankIds.add(h.id);
    if (topicIds.size && !topicIds.has(h.topic)) errors.push(`history-bank ${h.id}: topic "${h.topic}" is not in content/lang/topics.json`);
    errors.push(...intentErrors(`history-bank ${h.id}`, h.intents));
  }

  for (const ms of c.markSheets) {
    if (ms.domain && ms.passThreshold === undefined) errors.push(`mark sheet ${ms.id}: a domain sheet needs a passThreshold`);
    const ids = new Set<string>();
    for (const item of ms.items) {
      if (ids.has(item.id)) errors.push(`mark sheet ${ms.id}: duplicate item id "${item.id}"`);
      ids.add(item.id);
      if (item.rule) for (const e of ruleRefErrors(item.rule, c)) errors.push(`mark sheet ${ms.id} item ${item.id}: ${e}`);
      if (item.sourceText) errors.push(`mark sheet ${ms.id} item ${item.id}: sourceText must stay empty until copyright is cleared`);
      for (const pat of [...(item.match?.patterns ?? []), ...(item.match?.penalties ?? []).flatMap((p) => p.patterns)]) {
        try {
          new RegExp(pat, "i");
        } catch {
          errors.push(`mark sheet ${ms.id} item ${item.id}: pattern /${pat}/ does not compile`);
        }
      }
      for (const t of item.match?.topics ?? []) if (topicIds.size && !topicIds.has(t)) errors.push(`mark sheet ${ms.id} item ${item.id}: topic "${t}" is not in content/lang/topics.json`);
    }
  }
  return errors;
}

/** Patterns must compile; ids must be unique. Paraphrase counts are enforced from M1 (src/lang). */
export function intentErrors(where: string, intent: Intent): string[] {
  const out: string[] = [];
  for (const p of intent.patterns) {
    try {
      new RegExp(p, "i");
    } catch {
      out.push(`${where}: pattern /${p}/ does not compile`);
    }
  }
  return out;
}

export function mistakeRuleErrors(where: string, r: MistakeRule, c: ContentIndex): string[] {
  const out: string[] = [];
  const on = r.trigger.on;
  if (!on.type && !on.ref) out.push(`${where}: trigger.on needs a type or a ref`);
  if (on.ref) {
    const e = eventRefError(on.ref, c);
    if (e) out.push(`${where}: ${e}`);
  }
  for (const m of on.maneuver ? maneuverList(on.maneuver) : []) if (!c.maneuverById.has(m)) out.push(`${where}: unknown maneuver "${m}"`);
  for (const reg of on.region ? maneuverList(on.region) : []) if (!c.regionById.has(reg)) out.push(`${where}: unknown region "${reg}"`);
  for (const rule of [r.trigger.when, r.trigger.unless]) if (rule) out.push(...ruleRefErrors(rule, c).map((e) => `${where}: ${e}`));
  return out;
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
  } else if ("happened" in rule) {
    const err = eventRefError(rule.happened, c);
    if (err) out.push(err);
  } else if ("technique" in rule) {
    maneuverList(rule.technique.maneuver).forEach(checkManeuver);
    for (const r of rule.technique.regions ?? []) if (!c.regionById.has(r)) out.push(`unknown region "${r}"`);
  } else if ("placedWithin" in rule) {
    maneuverList(rule.placedWithin.maneuver).forEach(checkManeuver);
    for (const r of rule.placedWithin.regions ?? []) {
      if (!c.regionById.has(r)) out.push(`unknown region "${r}"`);
      else if (!maneuverList(rule.placedWithin.maneuver).some((m) => c.maneuverById.get(m)?.allowedRegions.includes(r))) {
        out.push(`region "${r}" is not allowed for ${maneuverList(rule.placedWithin.maneuver).join("/")}`);
      }
    }
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

const TYPES = [
  "examine",
  "say",
  "courtesy",
  "submit_ddx",
  "submit_pen",
  "note",
  "state_change",
  "hint",
  "room",
  "touch",
  "drape_change",
  "describe_exam",
  "tool_contact",
  "interpretation",
  "settings",
  "mistake",
  "patient_say",
  "timer",
  "sit_down",
  "prohibited_attempt",
];
const TIMER_EVENTS = ["pause", "resume", "warning", "auto_end", "begin", "encounter_warning", "encounter_end", "pen_warning", "pen_lock"];

export function eventRefError(ref: string, c: ContentIndex): string | null {
  const [head, rest] = ref.includes(":") ? [ref.slice(0, ref.indexOf(":")), ref.slice(ref.indexOf(":") + 1)] : [ref, ""];
  if (!rest) return CourtesyKind.safeParse(head).success || TYPES.includes(head) ? null : `unknown event ref "${ref}"`;
  switch (head) {
    case "first":
    case "last":
      return TYPES.includes(rest) || !eventRefError(rest, c) ? null : `unknown action type in "${ref}"`;
    case "drape": {
      if (rest === "cover" || rest === "expose") return null;
      const [ev, sec] = rest.split(":");
      return (ev === "cover" || ev === "expose") && DrapeSection.safeParse(sec).success ? null : `unknown drape event in "${ref}"`;
    }
    case "mistake":
      return /^[a-z0-9][a-z0-9_.-]*$/.test(rest) ? null : `bad mistake id in "${ref}"`;
    case "region":
      return c.regionById.has(rest) ? null : `unknown region in "${ref}"`;
    case "maneuver":
      return c.maneuverById.has(rest) ? null : `unknown maneuver in "${ref}"`;
    case "position":
      return Position.safeParse(rest).success ? null : `unknown position in "${ref}"`;
    case "tag":
      return CourtesyTag.safeParse(rest).success ? null : `unknown tag in "${ref}"`;
    case "room":
      return ["knock", "enter", "exit"].includes(rest) ? null : `unknown room event in "${ref}"`;
    case "timer":
      return TIMER_EVENTS.includes(rest) ? null : `unknown timer event in "${ref}"`;
    case "describe":
    case "prohibited":
      return c.regionById.has(rest) ? null : `unknown region in "${ref}"`;
    default:
      return `unknown event ref "${ref}"`;
  }
}
