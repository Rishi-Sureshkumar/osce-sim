import { describe, expect, it } from "vitest";
import { needsModelFallback, regexTags } from "@/server/tags";

const tags = (t: string) => regexTags(t).map((h) => h.tag).sort();

describe("courtesy tags (regex pass)", () => {
  it("introductions: name and role, evidence verbatim", () => {
    const text = "Hello Mr. Bennett, my name is Sam Patel and I'm a medical student.";
    const hits = regexTags(text);
    expect(hits.map((h) => h.tag).sort()).toEqual(["introduced_name", "stated_role"]);
    for (const h of hits) expect(text).toContain(h.evidence);
    expect(tags("Hi, I'm Alex, one of the third-year medical students")).toEqual(["introduced_name", "stated_role"]);
  });
  it("consent, explanation, comfort, questions, closing", () => {
    expect(tags("Is it okay if I examine your chest now?")).toEqual(["asked_consent_exam"]);
    expect(tags("I'm going to listen to your heart with my stethoscope.")).toEqual(["explained_procedure"]);
    expect(tags("Are you comfortable? Let me know if anything hurts.")).toEqual(["asked_comfort"]);
    expect(tags("Do you have any questions for me?")).toEqual(["offered_questions"]);
    expect(tags("Thank you for your time, take care.")).toEqual(["closing"]);
    expect(tags("May I take a look at your ankles?")).toEqual(["asked_consent_exam"]);
  });
  it("identity confirmation", () => {
    expect(tags("Could you please tell me your full name and date of birth?")).toEqual(["confirmed_patient_identity"]);
  });
  it("positioning requests carry the position", () => {
    const pos = (t: string) => regexTags(t).find((h) => h.tag === "requested_position")?.position;
    expect(pos("Could you sit up for me?")).toBe("seated");
    expect(pos("Please lie back for me")).toBe("reclined_30");
    expect(pos("Can you lie back to about 45 degrees?")).toBe("reclined_45");
    expect(pos("Could you roll onto your left side?")).toBe("left_lateral_decubitus");
    expect(pos("Lean forward a little")).toBe("seated_leaning_forward");
    expect(pos("Please lie flat")).toBe("supine");
    expect(pos("Thanks. Now could you just sit up again?")).toBe("seated");
    // questions about symptoms are not requests
    expect(pos("Do you get short of breath when you lie flat at night?")).toBeUndefined();
    expect(pos("Does it hurt when you sit up?")).toBeUndefined();
    expect(pos("Can you lie flat at night without getting breathless?")).toBeUndefined();
  });
  it("history questions are not tagged; fallback only when cue words are present", () => {
    expect(regexTags("How long have you been short of breath?")).toEqual([]);
    expect(needsModelFallback("How long have you been short of breath?", [])).toBe(false);
    expect(needsModelFallback("Before we start, would you be alright with me examining you?", [])).toBe(true);
    expect(needsModelFallback("Is it okay if I examine you?", regexTags("Is it okay if I examine you?"))).toBe(false);
  });
});

import { ActionInput } from "@/domain/schemas";
import { verifiedTags } from "@/server/ai/tagger";

describe("tag integrity", () => {
  it("the browser cannot send tags: they are stripped from action input", () => {
    const parsed = ActionInput.parse({ type: "say", source: "text", payload: { text: "hi", tags: [{ tag: "closing", evidence: "hi", via: "regex" }] } });
    expect(parsed.type === "say" && "tags" in parsed.payload).toBe(false);
  });
  it("model tags survive only with verbatim evidence", () => {
    const text = "Before we start, would you be alright with me examining you?";
    const out = verifiedTags(text, [
      { tag: "asked_consent_exam", evidence: "would you be alright with me examining you", position: null },
      { tag: "introduced_name", evidence: "my name is Sam", position: null },
      { tag: "requested_position", evidence: "Before we start", position: null },
    ]);
    expect(out).toEqual([{ tag: "asked_consent_exam", evidence: "would you be alright with me examining you", via: "model" }]);
  });
});
