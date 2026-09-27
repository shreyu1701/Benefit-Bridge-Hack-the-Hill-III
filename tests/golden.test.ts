import { describe, expect, it } from "vitest";
import { SEED_PROGRAMS } from "@/data/programs";
import { matchProgram } from "@/lib/rules/engine";
import { CODE, GOLDEN_PEOPLE } from "./golden/people";

describe("golden set: expected result for every person and every program", () => {
  it("covers every program", () => {
    for (const p of GOLDEN_PEOPLE) expect(Object.keys(p.expect).sort()).toEqual(SEED_PROGRAMS.map((x) => x.id).sort());
  });

  for (const person of GOLDEN_PEOPLE) {
    it(person.name, () => {
      const wrong: string[] = [];
      for (const program of SEED_PROGRAMS) {
        const want = CODE[person.expect[program.id as keyof typeof person.expect]];
        const r = matchProgram(program, person.facts);
        if (r.confidence !== want) {
          const why = r.criteria.filter((c) => c.outcome !== "met" && c.outcome !== "not_applicable").map((c) => `${c.id}=${c.outcome}`);
          wrong.push(`${program.id}: got ${r.confidence}, expected ${want} [${why.join(", ")}] — check ${program.source_url}`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }
});
