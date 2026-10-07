import { describe, expect, it } from "vitest";
import type { Action, ActionInput } from "@/domain/schemas";
import { loadContentFromDisk } from "@/content/loadFromDisk";
import { scoreDeterministicItems } from "@/engine/scoring";
import { patientState } from "@/engine/patientState";
import { regexTags } from "@/server/tags";
import { makeLog } from "./helpers";

const c = loadContentFromDisk();
const exam = c.markSheetById.get("exam-fcm1")!;
const history = c.markSheetById.get("communication-1b")!;

/** a `say` tagged the way the chat service tags it */
const said = (text: string): ActionInput => ({ type: "say", source: "voice", payload: { text, tags: regexTags(text) } }) as unknown as ActionInput;
const room = (event: "knock" | "enter" | "exit"): ActionInput => ({ type: "room", source: "click", payload: { event } });
const hygiene: ActionInput = { type: "courtesy", source: "click", payload: { kind: "hand_hygiene" } };
const touch = (m: string, r: string): ActionInput => ({ type: "examine", source: "click", payload: { maneuverId: m, regionId: r, touch: true } }) as unknown as ActionInput;
const drape = (zone: "chest" | "abdomen" | "legs", covered: boolean): ActionInput => ({ type: "state_change", source: "click", payload: { drape: { zone, covered }, via: "direct" } });

const score = (log: Action[], sheet = exam) => Object.fromEntries(scoreDeterministicItems(sheet, log, "exam").map((s) => [s.itemId, s.value]));

describe("M5 encounter flow scoring", () => {
  const good = makeLog([
    room("knock"),
    room("enter"),
    hygiene,
    said("Hello, my name is Sam Patel, I'm a medical student."),
    said("Is it okay if I examine your chest?"),
    drape("chest", false),
    touch("auscultate_heart_diaphragm", "cardiac_mitral"),
    drape("chest", true),
    said("Thank you for your time, take care."),
    hygiene,
    room("exit"),
  ]);

  it("tags and state changes decide the courtesy items", () => {
    const s = score(good);
    expect(s["fcm-01-hand-hygiene"]).toBe(1);
    expect(s["fcm-03-drape"]).toBe(1);
    expect(s["courtesy-introduce"]).toBe(1);
    expect(s["courtesy-consent"]).toBe(1);
    expect(s["courtesy-exit-hygiene"]).toBe(1);
    expect(s["courtesy-closing"]).toBe(1);
    expect(score(good, history)["introduce-self-role"]).toBe(1);
  });

  it("missing steps lose exactly those items", () => {
    const bad = makeLog([
      room("enter"),
      touch("auscultate_heart_diaphragm", "cardiac_mitral"), // before hygiene and before consent
      hygiene,
      said("Is it okay if I examine your chest?"),
      room("exit"), // no goodbye, no hygiene after the last touch... (hygiene came after it, so exit hygiene passes)
    ]);
    const s = score(bad);
    expect(s["fcm-01-hand-hygiene"]).toBe(0);
    expect(s["courtesy-consent"]).toBe(0);
    expect(s["courtesy-introduce"]).toBe(0);
    expect(s["courtesy-closing"]).toBe(0);
    expect(s["fcm-03-drape"]).toBe(0); // the auto-expose of a zone is not draping
    const noExitHygiene = makeLog([room("enter"), hygiene, touch("auscultate_heart_diaphragm", "cardiac_mitral"), room("exit")]);
    expect(score(noExitHygiene)["courtesy-exit-hygiene"]).toBe(0);
  });

  it("patient state follows room events, bed and drape changes", () => {
    const st = patientState(good);
    expect(st.inRoom).toBe(false);
    expect(st.knocked).toBe(true);
    expect(st.drape.chest).toBe(true);
    const mid = patientState(good.slice(0, 7));
    expect(mid.inRoom).toBe(true);
    expect(mid.handsClean).toBe(true);
    expect(mid.drape.chest).toBe(false);
    const bed = patientState(makeLog([{ type: "state_change", source: "voice", payload: { position: "reclined_45", via: "verbal" } }]));
    expect(bed.position).toBe("reclined_45");
    expect(bed.bedAngle).toBe(45);
  });
});
