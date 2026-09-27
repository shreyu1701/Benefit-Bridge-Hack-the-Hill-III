import { describe, expect, it } from "vitest";
import { SEED_PROGRAMS } from "@/data/programs";
import type { ProgramView } from "@/lib/programs-repo";
import { buildCards, relevanceOf, uncoveredNeeds } from "@/lib/present";
import { GOLDEN_PEOPLE } from "./golden/people";

const PROGRAMS: ProgramView[] = SEED_PROGRAMS.map((p) => ({ ...p, status_reason: null, has_pending_review: false, source_last_changed: null, laws: [] }));
const ORDER = { likely: 0, possibly: 1, not_eligible: 2 } as const;
const torontoParent = GOLDEN_PEOPLE[0].facts;

describe("ranking by what the person told us", () => {
  it("relevance never changes a verdict", () => {
    const plain = buildCards(PROGRAMS, torontoParent, "en");
    const told = buildCards(PROGRAMS, { ...torontoParent, needs: ["transit", "food"], life_events: ["lost_job"] }, "en");
    const verdicts = (cards: typeof plain) => Object.fromEntries(cards.map((c) => [c.id, c.confidence]));
    expect(verdicts(told)).toEqual(verdicts(plain));
  });

  it("relevance only reorders within a confidence group", () => {
    // Needs that match "possibly" and "not eligible" programs must not lift them above "likely" ones.
    const cards = buildCards(PROGRAMS, { ...torontoParent, needs: ["transit", "education_training"], life_events: ["started_school"] }, "en");
    const order = cards.map((c) => ORDER[c.confidence]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("puts the related program first among equals", () => {
    const cards = buildCards(PROGRAMS, { ...torontoParent, needs: ["transit"] }, "en");
    const possibly = cards.filter((c) => c.confidence === "possibly");
    expect(possibly[0].id).toBe("to-fair-pass");
    expect(possibly[0].relevance).toEqual({ needs: ["transit"], life_events: [] });
  });

  it("says which needs no possible program covers", () => {
    const facts = { ...torontoParent, needs: ["transit", "caregiving", "education_training"] as const };
    const cards = buildCards(PROGRAMS, { ...facts, needs: [...facts.needs] }, "en");
    // Fair Pass is "possibly" → transit is covered. OSAP covers school but is "not eligible" here → not covered.
    expect(uncoveredNeeds(cards, { ...torontoParent, needs: [...facts.needs] })).toEqual(["caregiving", "education_training"]);
  });

  it("nothing mentioned → no relevance, no gaps", () => {
    expect(relevanceOf(PROGRAMS[0], torontoParent)).toEqual({ needs: [], life_events: [] });
    expect(uncoveredNeeds(buildCards(PROGRAMS, torontoParent, "en"), torontoParent)).toEqual([]);
  });
});
