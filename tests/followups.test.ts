import { describe, expect, it } from "vitest";
import { SEED_PROGRAMS } from "@/data/programs";
import { emptyFacts, type Facts } from "@/lib/facts/schema";
import { answerOptions, rankFollowups } from "@/lib/rules/followups";
import { matchProgram } from "@/lib/rules/engine";
import { GOLDEN_PEOPLE } from "./golden/people";

const parent = GOLDEN_PEOPLE[0].facts;
const partial: Facts = { ...parent, residency_status: null, has_dental_insurance: null, files_taxes: null };

describe("follow-up questions that change results", () => {
  it("asks first about what can move a result; tax filing alone can't move anything yet", () => {
    const q = rankFollowups(SEED_PROGRAMS, { ...emptyFacts(), province: "ON", city: "Toronto" }, { limit: 10 });
    expect(q[0].fact).toBe("age");
    const taxes = q.find((x) => x.fact === "files_taxes")!;
    expect(taxes.could_change).toBe(0);
    expect(q.filter((x) => x.could_change > 0).every((x) => q.indexOf(x) < q.indexOf(taxes))).toBe(true);
  });

  it("could_change is true: some answer really moves that many programs", () => {
    const [top] = rankFollowups(SEED_PROGRAMS, partial);
    const moved = SEED_PROGRAMS.filter((p) => {
      const before = matchProgram(p, partial).confidence;
      return before !== "not_eligible" && answerOptions(top.fact, SEED_PROGRAMS).some((v) => matchProgram(p, { ...partial, [top.fact]: v }).confidence !== before);
    });
    expect(moved.length).toBe(top.could_change);
    expect(top.could_change).toBeGreaterThan(0);
  });

  it("what the person came for counts double", () => {
    expect(rankFollowups(SEED_PROGRAMS, partial)[0].fact).not.toBe("has_dental_insurance");
    expect(rankFollowups(SEED_PROGRAMS, { ...partial, needs: ["health_dental"] })[0].fact).toBe("has_dental_insurance");
  });

  it("respects skipped questions and never asks about life events or needs", () => {
    const q = rankFollowups(SEED_PROGRAMS, partial, { limit: 10, skip: ["files_taxes"] }).map((x) => x.fact);
    expect(q).not.toContain("files_taxes");
    expect(q).not.toContain("needs");
    expect(q).not.toContain("life_events");
  });

  it("tries the ages on both sides of every age rule", () => {
    const ages = answerOptions("age", SEED_PROGRAMS) as number[];
    for (const edge of [17, 18, 19, 20, 64, 65, 66]) expect(ages).toContain(edge);
  });

  it("nothing left to ask when everything is known", () => {
    expect(rankFollowups(SEED_PROGRAMS, parent)).toEqual([]);
  });
});
