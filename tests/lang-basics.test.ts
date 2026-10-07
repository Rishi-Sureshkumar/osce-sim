/** M1: the pure language modules (normalise, split, negation, question type, vectors). */
import { describe, expect, it } from "vitest";
import { cosine, isValidEmbedding, l2normalize, pack, unpack } from "@/lang/embed/vectors";
import { isNegated, polarityOf } from "@/lang/negation";
import { basicNormalize, hasPhrase, makeNormalizer } from "@/lang/normalize";
import { questionType } from "@/lang/question";
import { splitClauses } from "@/lang/split";

describe("normalize", () => {
  it("lowercases, expands contractions, maps number words, strips punctuation", () => {
    expect(basicNormalize("I’m SOB—can’t lie flat! What’s up? Two-three pillows.")).toBe("i am sob cannot lie flat what is up 2 3 pillows");
    expect(basicNormalize("2-3 weeks")).toBe("2 to 3 weeks");
    expect(basicNormalize("Mr. Bennett's meds")).toBe("mr bennett meds");
  });
  it("applies synonyms longest first, whole words only", () => {
    const n = makeNormalizer([
      { to: "short of breath", from: ["SOB", "breathless", "dyspnoea", "short of breath on exertion"] },
      { to: "short of breath on exertion", from: ["DOE", "short of breath on exertion"] },
    ]);
    expect(n("Are you SOB?")).toBe("are you short of breath");
    expect(n("any DOE")).toBe("any short of breath on exertion");
    expect(n("sobbing")).toBe("sobbing"); // not inside words
  });
  it("hasPhrase matches whole words", () => {
    expect(hasPhrase("any chest pain today", "chest pain")).toBe(true);
    expect(hasPhrase("minimal effort", "mi")).toBe(false);
  });
});

describe("splitClauses", () => {
  it("splits sentences and distributes a shared lead-in over a short list", () => {
    expect(splitClauses("Any chest pain or fever? And do you smoke?")).toEqual(["any chest pain", "any fever", "and do you smoke"]);
    expect(splitClauses("Have you had any cough, wheeze or palpitations?")).toEqual(["have you had any cough", "have you had any wheeze", "have you had any palpitations"]);
  });
  it("splits a second question joined with 'and'", () => {
    expect(splitClauses("How long has this been going on and do you get chest pain?")).toEqual(["how long has this been going on", "do you get chest pain"]);
  });
  it("keeps one long question intact and caps at 5 clauses", () => {
    expect(splitClauses("Do you get short of breath when you walk up the stairs to your bedroom?")).toHaveLength(1);
    expect(splitClauses("a? b? c? d? e? f? g?")).toHaveLength(5);
  });
});

describe("negation", () => {
  it("finds negated and affirmed mentions", () => {
    expect(isNegated("patient denies chest pain", "chest pain")).toBe(true);
    expect(isNegated("no fever or chills", "chills")).toBe(true);
    expect(isNegated("jvp not raised", "jvp")).toBe(true);
    expect(isNegated("chest pain on exertion", "chest pain")).toBe(false);
    expect(isNegated("no fever but has chest pain", "chest pain")).toBe(false);
    expect(polarityOf("crackles at both bases", "crackles")).toBe("affirmed");
    expect(polarityOf("crackles at both bases", "wheeze")).toBe("absent");
  });
});

describe("questionType", () => {
  it("tells open from closed questions", () => {
    expect(questionType("what brings you in today")).toBe("open");
    expect(questionType("tell me about the breathlessness")).toBe("open");
    expect(questionType("do you smoke")).toBe("closed");
    expect(questionType("any chest pain")).toBe("closed");
    expect(questionType("that sounds hard")).toBe("statement");
  });
});

describe("vectors", () => {
  it("int8 packing keeps cosine similarity within 0.01", () => {
    const a = l2normalize(Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.37)));
    const b = l2normalize(Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.37 + 0.4)));
    expect(Math.abs(cosine(unpack(pack(a)), unpack(pack(b))) - cosine(a, b))).toBeLessThan(0.01);
    expect(isValidEmbedding(Array.from(a))).toBe(true);
    expect(isValidEmbedding([1, 2, 3])).toBe(false);
  });
});

describe("splitClauses: second verb phrase", () => {
  it("splits 'do you drink alcohol or take any drugs'", () => {
    expect(splitClauses("Do you drink alcohol or take any drugs?")).toEqual(["do you drink alcohol", "take any drugs"]);
    expect(splitClauses("Do you get short of breath when you walk or climb stairs?")).toHaveLength(1);
  });
});

describe("normaliser: contractions typed without an apostrophe", () => {
  it("expands only the unambiguous ones", () => {
    expect(basicNormalize("dont you smoke? whats wrong, im fine, youre ok, thats it, it's its, ill, were, well, cant, wont, havent")).toBe(
      "do not you smoke what is wrong i am fine you are ok that is it it is its ill were well cannot will not have not",
    );
  });
});
