import { z } from "zod";
import { parseFacts } from "@/lib/facts/schema";
import { deriveData } from "@/lib/facts/derive";
import { hasDatabase, query } from "@/lib/db/pool";
import { errorResponse, json } from "@/lib/http";
import { loadPrograms } from "@/lib/programs-repo";
import { buildCards, buildFollowups, buildPersonas, regionOf, type MatchResponse, type ProgramCard } from "@/lib/present";
import { translateMany } from "@/lib/translate-cache";

const Body = z.object({
  facts: z.unknown(),
  /** Any BCP-47 language for results. en/fr are native; others are machine-translated. */
  lang: z.string().min(2).max(20).default("en"),
  skip_questions: z.array(z.string()).max(30).default([]),
});

/**
 * POST /api/match — deterministic matching over approved program data.
 * The LLM is not involved in eligibility; it is only used (optionally) to
 * translate the already-computed, verified English text into other languages.
 */
export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const facts = parseFacts(body.facts);
    const base = body.lang.toLowerCase().split("-")[0];
    const uiLang = base === "fr" ? "fr" : "en";

    const programs = await loadPrograms();
    let cards = buildCards(programs, facts, uiLang);
    let followups = buildFollowups(programs, facts, uiLang, body.skip_questions);
    let personas = buildPersonas(programs, facts, uiLang);
    let machine_translated = false;

    if (base !== "en" && base !== "fr") {
      const translated = await translateResponse(cards, followups, personas, base).catch(() => null);
      if (translated) {
        ({ cards, followups, personas } = translated);
        machine_translated = true;
      }
    }

    recordMatches(cards, regionOf(facts, deriveData(facts).municipality));

    const res: MatchResponse = { lang: machine_translated ? base : uiLang, machine_translated, cards, followups, personas };
    return json(res);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Anonymous analytics: program + jurisdiction-level region + time. No facts, no identifiers. */
function recordMatches(cards: ProgramCard[], region: string) {
  if (!hasDatabase()) return;
  const hits = cards.filter((c) => c.confidence !== "not_eligible");
  if (!hits.length) return;
  const values = hits.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",");
  query(`INSERT INTO match_events (program_id, region, confidence) VALUES ${values}`, hits.flatMap((c) => [c.id, region, c.confidence])).catch((e) =>
    console.error("match_events insert failed", e),
  );
}

async function translateResponse(
  cards: ProgramCard[],
  followups: MatchResponse["followups"],
  personas: MatchResponse["personas"],
  lang: string,
) {
  // Collect every display string, translate in one batch, then put them back in the same order.
  const texts: string[] = [];
  const take = (s: string | null | undefined) => (s ? (texts.push(s), texts.length - 1) : -1);
  const plan = {
    cards: cards.map((c) => ({
      name: take(c.name), summary: take(c.summary), how: take(c.how_to_apply), amount: take(c.amount?.text),
      met: c.reasons_met.map((r) => take(r.text)), unc: c.uncertain.map((r) => take(r.text)), fail: c.failed.map((r) => take(r.text)),
      also: c.also_required.map(take), dl: c.deadlines.map((d) => take(d.label)),
    })),
    fu: followups.map((f) => ({ q: take(f.question), h: take(f.help) })),
    ps: personas.map((p) => ({ b: take(p.blurb), pos: p.possibly.map((x) => take(x.check)) })),
  };
  const tr = await translateMany(texts, lang);
  if (!tr) return null;
  const g = (i: number, fallback: string) => (i >= 0 ? tr[i] : fallback);
  return {
    cards: cards.map((c, i) => {
      const p = plan.cards[i];
      return {
        ...c,
        name: `${g(p.name, c.name)}${g(p.name, c.name) !== c.name ? ` (${c.name})` : ""}`,
        summary: g(p.summary, c.summary),
        how_to_apply: g(p.how, c.how_to_apply),
        amount: c.amount ? { ...c.amount, text: g(p.amount, c.amount.text) } : null,
        reasons_met: c.reasons_met.map((r, j) => ({ ...r, text: g(p.met[j], r.text) })),
        uncertain: c.uncertain.map((r, j) => ({ ...r, text: g(p.unc[j], r.text) })),
        failed: c.failed.map((r, j) => ({ ...r, text: g(p.fail[j], r.text) })),
        also_required: c.also_required.map((a, j) => g(p.also[j], a)),
        deadlines: c.deadlines.map((d, j) => ({ ...d, label: g(p.dl[j], d.label) })),
      };
    }),
    followups: followups.map((f, i) => ({ ...f, question: g(plan.fu[i].q, f.question), help: f.help ? g(plan.fu[i].h, f.help) : null })),
    personas: personas.map((p, i) => ({
      ...p,
      blurb: g(plan.ps[i].b, p.blurb),
      possibly: p.possibly.map((x, j) => ({ ...x, check: g(plan.ps[i].pos[j], x.check) })),
    })),
  };
}
