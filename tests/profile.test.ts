import { describe, expect, it } from "vitest";
import { ProfileSchema, emptyProfile, parseProfile, type Profile } from "@/lib/profile/schema";
import { diffFacts } from "@/lib/profile/merge";
import { decryptJson, encryptJson } from "@/lib/crypto";
import { toGeminiSchema } from "@/lib/llm/json-schema";

const p = (f: Partial<Profile>): Profile => ({ ...emptyProfile(), ...f });

describe("ProfileSchema is the single source of truth", () => {
  it("drops unknown keys and fills missing ones with null", () => {
    const r = parseProfile({ age: 40, sin: "123456789" });
    expect(r.age).toBe(40);
    expect("sin" in r).toBe(false);
    expect(r.files_taxes).toBeNull();
  });

  it("rejects invalid values instead of storing them", () => {
    expect(() => parseProfile({ age: 250 })).toThrow();
    expect(() => parseProfile({ province: "Ontario" })).toThrow();
  });

  it("per-screen validation works with pick()", () => {
    const screen = ProfileSchema.pick({ province: true, city: true });
    expect(screen.safeParse({ province: "ON", city: "Toronto" }).success).toBe(true);
    expect(screen.safeParse({ province: "XX", city: null }).success).toBe(false);
  });

  it("the Gemini schema only uses keywords Gemini supports", () => {
    const allowed = new Set(["type", "enum", "format", "title", "description", "properties", "additionalProperties", "required", "items", "minItems", "maxItems", "minimum", "maximum", "anyOf", "prefixItems"]);
    const walk = (n: unknown, path: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${path}[${i}]`));
      if (!n || typeof n !== "object") return;
      for (const [k, v] of Object.entries(n)) {
        if (path.endsWith(".properties")) walk(v, `${path}.${k}`);
        else {
          expect(allowed.has(k), `${path}.${k}`).toBe(true);
          expect(Array.isArray(v) && k === "type", `${path}.type must not be an array`).toBe(false);
          walk(v, `${path}.${k}`);
        }
      }
    };
    walk(toGeminiSchema(ProfileSchema), "$");
  });
});

describe("diffFacts (profile vs what they said)", () => {
  const profile = p({ province: "ON", city: "Toronto", age: 29, children_ages: [4, 2], files_taxes: true });

  it("labels each value's source and lists new facts", () => {
    const d = diffFacts(profile, p({ employment_status: "employed", city: "toronto " }));
    expect(d.sources.age).toBe("profile");
    expect(d.sources.employment_status).toBe("said");
    expect(d.new).toEqual(["employment_status"]);
    expect(d.agreed).toEqual(["city"]); // case/whitespace-insensitive
    expect(d.conflicts).toEqual([]);
  });

  it("children in a different order are the same children", () => {
    expect(diffFacts(profile, p({ children_ages: [2, 4] })).conflicts).toEqual([]);
  });

  it("reports conflicts and defaults to the newest statement", () => {
    const d = diffFacts(profile, p({ children_ages: [2, 4, 7] }));
    expect(d.conflicts).toEqual([{ fact: "children_ages", profile_value: [4, 2], said_value: [2, 4, 7] }]);
    expect(d.merged.children_ages).toEqual([2, 4, 7]);
  });

  it("life events and needs add up instead of conflicting", () => {
    const saved = p({ needs: ["transit"], life_events: ["new_to_canada"] });
    const d = diffFacts(saved, p({ needs: ["rent_housing"], life_events: ["new_to_canada"] }));
    expect(d.conflicts).toEqual([]);
    expect(d.merged.needs).toEqual(["rent_housing", "transit"]); // schema order
    expect(d.sources.needs).toBe("said");
    expect(d.new).toEqual(["needs"]);
    expect(d.agreed).toEqual(["life_events"]);
  });

  it("an empty or reordered list of needs is not news", () => {
    const saved = p({ needs: ["transit", "food"] });
    expect(diffFacts(saved, p({ needs: [] })).agreed).toEqual(["needs"]);
    expect(diffFacts(saved, p({ needs: ["food", "transit"] })).agreed).toEqual(["needs"]);
  });

  it("works with no profile (guest before onboarding)", () => {
    const d = diffFacts(null, p({ age: 30 }));
    expect(d.merged.age).toBe(30);
    expect(d.new).toEqual(["age"]);
  });
});

describe("profile encryption (AES-256-GCM)", () => {
  process.env.PROFILE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptJson(profile());
    const b = encryptJson(profile());
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(decryptJson(a.data, a.iv)).toEqual(profile());
  });

  it("detects tampering", () => {
    const e = encryptJson(profile());
    e.data[0] ^= 0xff;
    expect(() => decryptJson(e.data, e.iv)).toThrow();
  });

  function profile() {
    return p({ residency_status: "refugee_claimant", family_income_band: "15k_25k" });
  }
});
