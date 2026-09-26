/**
 * Idempotent seed: jurisdictions, laws, programs, watched source pages, law links.
 *
 * Programs are inserted with status "needs_verification". Re-running the seed
 * NEVER overwrites a program that a human has approved (revision > 1 or
 * approved_by set) — approved content is owned by the review workflow.
 */
import { JURISDICTIONS } from "@/data/jurisdictions";
import { SEED_LAWS, SEED_PROGRAM_LAW_LINKS } from "@/data/laws";
import { SEED_PROGRAMS } from "@/data/programs";
import { watchedUrlsFor } from "@/data/sources";
import { closePool, withTransaction } from "@/lib/db/pool";

async function main() {
  await withTransaction(async (c) => {
    for (const j of JURISDICTIONS) {
      await c.query(
        `INSERT INTO jurisdictions (code, level, name, parent_code, province_code, municipality_code, config)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (code) DO UPDATE SET level=$2, name=$3, parent_code=$4, province_code=$5, municipality_code=$6, config=$7`,
        [j.code, j.level, j.name, j.parent, j.province, j.municipality, { cityAliases: j.cityAliases ?? [], allowedDomains: j.allowedDomains }],
      );
    }

    for (const l of SEED_LAWS) {
      await c.query(
        `INSERT INTO laws (id, jurisdiction_code, kind, citation, title, source_url, xml_url, what_changed, what_changed_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET citation=$4, title=$5, source_url=$6, xml_url=$7,
           what_changed = CASE WHEN laws.what_changed_approved THEN laws.what_changed ELSE $8 END`,
        [l.id, l.jurisdiction, l.kind, l.citation, l.title, l.source_url, l.xml_url, l.what_changed, l.approved],
      );
    }

    for (const p of SEED_PROGRAMS) {
      const lawId = SEED_PROGRAM_LAW_LINKS.find((x) => x.program_id === p.id)?.law_id ?? null;
      await c.query(
        `INSERT INTO programs (id, name, level, jurisdiction_code, eligibility_rules, benefit_amount, deadlines, how_to_apply,
                               application_url, source_url, source_law_id, status, status_reason, summaries_by_language)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'needs_verification','Seeded; awaiting first live check and human approval',$12)
         ON CONFLICT (id) DO UPDATE SET
           name=$2, eligibility_rules=$5, benefit_amount=$6, deadlines=$7, how_to_apply=$8, application_url=$9,
           source_url=$10, source_law_id=$11, summaries_by_language=$12, updated_at=now()
         WHERE programs.approved_by IS NULL AND programs.revision = 1`,
        [p.id, p.name, p.level, p.jurisdiction, p.eligibility_rules, p.benefit_amount, JSON.stringify(p.deadlines), p.how_to_apply,
         p.application_url, p.source_url, lawId, p.summaries_by_language],
      );
      for (const w of watchedUrlsFor(p)) {
        await c.query(
          `INSERT INTO program_sources (program_id, url, check_interval_hours) VALUES ($1,$2,$3)
           ON CONFLICT (program_id, url) DO UPDATE SET check_interval_hours = $3`,
          [p.id, w.url, w.intervalHours],
        );
      }
    }

    for (const link of SEED_PROGRAM_LAW_LINKS) {
      await c.query(
        `INSERT INTO program_law_links (program_id, law_id, relationship) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [link.program_id, link.law_id, link.relationship],
      );
    }
  });
  console.log(`Seeded ${JURISDICTIONS.length} jurisdictions, ${SEED_LAWS.length} laws, ${SEED_PROGRAMS.length} programs.`);
  await closePool();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
