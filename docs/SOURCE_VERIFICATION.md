# Source verification report

_Status as of 2026-09-26._

## How this was verified, and the limits

The build environment's network policy **blocked direct HTTP access to every
government host** (`www.parl.ca`, `canada.ca`, `ontario.ca`, `ola.org`,
`gazette.gc.ca`, `laws-lois.justice.gc.ca`, `open.canada.ca`,
`data.ontario.ca`, `toronto.ca` all returned a proxy `403 CONNECT rejected`). As a result:

- Each endpoint and page below was confirmed through **web search results restricted to the
  official domain**. Search returns the page's URL, title and snippets of its text; it is
  not the raw response.
- **No raw response bodies could be captured.** The "sample response" column shows the
  fields or text the snippets surfaced, not a saved payload.
- To finish verification, run these two commands from a network that can reach the hosts,
  then commit the output:
  - `npm run verify:sources` fetches every endpoint and program page and writes
    `docs/SOURCE_VERIFICATION.live.md` with the HTTP status, content type, "Date modified"
    and a real sample of each response.
  - `npm run fixtures:refresh` saves the real LEGISinfo feed, a real canada.ca page and the
    ola.org bills page as test fixtures. The real-feed tests then run automatically.

Until a reviewer approves them in `/admin`, **every seeded program ships as
`needs_verification`**, and the UI says so.

## ⚠️ Things you got wrong, or that have changed

| # | Item | Finding |
|---|------|---------|
| 1 | **GST/HST credit** | Renamed the **Canada Groceries and Essentials Benefit (CGEB)** as of July 2026. The CRA page `…/child-family-benefits/gst-hst-credit.html` is titled "GST/HST credit – No longer available". A one-time top-up was paid on June 5, 2026. The program is seeded as `ca-cgeb`, with "formerly the GST/HST credit" in its name. **The official French name was not verified**; mine is a translation. |
| 2 | **Canada Dental Care Plan** | The official name is the **Canadian** Dental Care Plan (CDCP), not "Canada". |
| 3 | **Ontario child care fee reduction** | Parents do **not** apply. The reduction is automatic at licensed providers enrolled in CWELCC. Fees were capped at **$22/day from Jan 1, 2025**, with a $10/day average target. I could not confirm the current cap for late 2026. |
| 4 | **Toronto Fair Pass** | Eligibility is **below 75% of the Low-Income Measure After-Tax (LIM-AT)**, updated February 2026. Examples: **$20,514** for 1 person, **$41,028** for 4. Annual eligibility reviews resume **August 1, 2026**. Only the two household sizes the page quotes are encoded; any other size is an explicit data gap. |
| 5 | **LEGISinfo** | Search confirms the current session is **45th Parliament, 1st session**, and that LEGISinfo offers JSON/XML export from the Bills page. I could not see a raw payload, so **none of your listed field names are verified**. The parser is permissive, detects the Parliament and session from the data, and fails loudly if the format changes completely. |
| 6 | **Canada Gazette Part III RSS** | The Part II feed `https://www.gazette.gc.ca/rss/p2-eng.xml` is confirmed on the official RSS page. A **Part III** feed URL was **not** confirmed. `p3-eng.xml` is configured by analogy, and the job logs rather than crashes if it doesn't exist. |
| 7 | **Justice Laws XML** | `https://laws-lois.justice.gc.ca/eng/XML/Legis.xml` is confirmed. It lists every Act and regulation with its consolidation date and XML/HTML links. Bulk XML is also on GitHub (`justicecanada/laws-lois-xml`) and point-in-time XML is on an FTP server. |
| 8 | **Canada Early Learning and Child Care Act** | Found while verifying: the citation is **S.C. 2024, c. 2** (Justice Laws id `C-3.55`), not c. 1. |
| 9 | **Ontario e-Laws** | No machine-readable API was found. Statutes are HTML pages at `https://www.ontario.ca/laws/statute/<id>`. Tier 3 hashes the page text to detect changes. |
| 10 | **City of Toronto Open Data** | The portal is CKAN (confirmed). The API host `ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action` comes from the portal's developer instructions as I remember them. **Not confirmed by search.** |

## Tier 1 — legislative status

| Source | Endpoint | Exists? | Format / fields | Update frequency | Terms |
|---|---|---|---|---|---|
| LEGISinfo (federal bills) | `https://www.parl.ca/legisinfo/en/bills/json` | Export confirmed on the LEGISinfo help/bills pages. **Exact JSON URL not directly fetched.** | JSON array of bills. Field names are taken from your spec (NumberCode, LongTitleEn/Fr, StatusNameEn/Fr, LatestCompletedMajorStageNameWithChamberSuffix, ParliamentNumber, SessionNumber, IsGovernmentBill, ReceivedRoyalAssent(DateTime), Passed{House,Senate}*DateTime, StatuteYear/Chapter, IsSessionOngoing, ShortLegislativeSummaryEn/Fr); unverified | Continuous while Parliament sits. We poll every 30 min. | Parliament of Canada content; reproduction permitted for non-commercial use with attribution (confirm on parl.ca "Important notices"). |
| Bill page | `https://www.parl.ca/legisinfo/en/bill/{P}-{S}/{c-2}` | URL pattern matches the search results for LEGISinfo pages | HTML | — | as above |
| Library of Parliament legislative summaries | `https://lop.parl.ca/sites/PublicWebsite/default/en_CA/ResearchPublications/LegislativeSummaries/{P}{S}{C}{N}E` | **Unverified** pattern | HTML | Written for some government bills only | as above |
| Ontario bills (ola.org) | `https://www.ola.org/en/legislative-business/bills/current`, `…/bills/parliament-44/session-1` | Confirmed: 44th Parliament, 1st session began April 14, 2025 | HTML only (no API). The status table's CSS selectors are **unverified**, so the parser is structural and fails loudly. | Hourly polling | Scraping is limited to robots.txt-permitted paths, at most one request per 2 s, identifying User-Agent, conditional requests |
| Canada Gazette Part II | `https://www.gazette.gc.ca/rss/p2-eng.xml` | Confirmed on `gazette.gc.ca/rss/sc-rb-eng.html` | RSS 2.0 items: publication date, title, short description | Biweekly issues (Wednesdays) | Free; Government of Canada terms |
| Canada Gazette Part III | `https://gazette.gc.ca/rss/p3-eng.xml` | **Unverified** | RSS 2.0 (assumed) | Irregular (after royal assent) | — |

## Tier 2 — program pages (human-approved)

Every seeded program and criterion cites one of these pages. ✔ means the URL appeared in
official-domain search results and a snippet supported the rule. ◐ means the URL was
confirmed but the rule came from my background knowledge, not a snippet.

| Program | Page(s) | Rule(s) encoded | Check |
|---|---|---|---|
| Canada Child Benefit | `canada.ca/…/canada-child-benefit/who-apply.html`, `…/how-much.html` | child < 18; citizen / PR / protected person / temporary resident ≥ 18 months; max $8,157 per child under 6 (Jul 2026–Jun 2027); AFNI threshold $38,237 | ✔ |
| Canada Groceries and Essentials Benefit | `…/gst-hst-credit/who-eligible.html`, `…/how-much.html` | age ≥ 19 (or partner or parent). Income limit = **data gap** | ✔ age / ◐ partner-or-parent exception |
| Canadian Dental Care Plan | `canada.ca/en/services/benefits/dental/dental-care-plan/qualify.html` | AFNI < $90,000; no access to dental insurance; co-pay tiers at $70k / $80k | ✔ |
| Canada Workers Benefit | `canada.ca/…/line-45300-canada-workers-benefit-cwb/who-is-eligible.html`, `…/how-much-you-can-get.html` | working income; phase-out ends at $37,742 (single) / $49,393 (family), 2025 tax year | ✔ thresholds / ◐ age-19, full-time-student rule |
| Old Age Security | `canada.ca/…/old-age-security/eligibility.html` | age ≥ 65; ≥ 10 years in Canada after 18; citizen or legal resident | ✔ residence / ◐ status mapping |
| Guaranteed Income Supplement | `…/guaranteed-income-supplement/eligibility.html`, `…/benefit-amount.html` | OAS criteria + income limit (**data gap**); max $1,123.17/month single (Oct 2026) | ✔ |
| Ontario Trillium Benefit | `ontario.ca/page/ontario-trillium-benefit` | age ≥ 18 or partner or parent; income limit = **data gap**; paid on the 10th monthly from July 2026 | ✔ structure / ◐ age rule |
| Ontario child care fee reduction | `ontario.ca/page/canada-ontario-early-years-and-child-care-agreement`, `ontario.ca/page/find-and-pay-child-care` | child < 6; no application | ✔ |
| OSAP | `ontario.ca/page/osap-ontario-student-assistance-program`, `ontario.ca/page/osap-definitions` | post-secondary student; citizen / PR / protected person | ✔ definitions / ◐ student rule |
| Ontario Works | `ontario.ca/page/eligibility-ontario-works-financial-assistance`, policy directive 3.1 | age ≥ 18; financial need = **data gap** (case-by-case) | ✔ need wording / ◐ status list |
| Toronto Fair Pass | `toronto.ca/…/transit-discount/` | ages 20–64; 75% of LIM-AT (sizes 1 and 4 only) | ✔ thresholds / ◐ 20–64 as an eligibility (not only income) rule |

**Update frequency:** federal pages change mostly around the July benefit-year rollover,
Ontario pages at budget time, and the Toronto page after LIM updates. We check them every
6, 12 and 24 hours respectively.
**Terms:** canada.ca and ontario.ca content is under the Open Government Licence (Canada /
Ontario) or the sites' terms of use. The city pages are under City of Toronto terms of use.
All three allow reproduction with attribution. Confirm with each site's "Terms and
conditions" before launch.

## Tier 3 — reference data

| Source | Endpoint | Confirmed | Notes |
|---|---|---|---|
| Justice Laws index | `https://laws-lois.justice.gc.ca/eng/XML/Legis.xml` | ✔ | Per-Act XML at `/eng/XML/{id}.xml` (pattern) |
| Justice Laws Acts used | I-3.3 (Income Tax Act), O-9 (Old Age Security Act), C-3.55 (Canada Early Learning and Child Care Act) | ✔ C-3.55 / ◐ the others (well-known ids) | |
| Ontario e-Laws | `https://www.ontario.ca/laws/statute/07t11`, `14c11`, `97o25a`, `90m19` | ◐ | HTML only |
| Open Government Portal (CKAN) | `https://open.canada.ca/data/api/action/package_show?id=…` | ✔ portal / ◐ API path (standard CKAN) | Tracked: OAS benefit-amount tables `dfa4daf1-669e-4514-82cd-982f27707ed0` (✔), which will fill the GIS data gap after review |
| Ontario Data Catalogue (CKAN) | `https://data.ontario.ca/api/3/action/…` | ◐ | |
| Toronto Open Data (CKAN) | `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/…` | ◐ | See item 10 above |

## Eligibility rules I could NOT verify from official sources

These are encoded as **explicit data gaps**: the engine returns "Possibly eligible — check
X" and never guesses.

1. CGEB (GST/HST credit) income cut-offs by family size.
2. GIS income thresholds. They are published quarterly in the OAS tables dataset, which is not yet ingested.
3. OTB component income limits (OEPTC, NOEC, OSTC).
4. Ontario Works financial-need test. It is assessed case by case and has no single threshold.
5. Fair Pass limits for household sizes other than 1 and 4.
6. CWB limits for people with a disability (the disability supplement).
7. CCB for visitors or "other" status. Temporary residents need a valid permit in the 19th month; we can't check permit validity.
8. OAS "legal resident" status for temporary residents or protected persons.
9. OSAP's Ontario residency duration requirement. It is listed as "also required", not encoded.
10. The CCB amount for children aged 6–17 in 2026–27. It is not shown because only the under-6 figure was confirmed.
11. The laws' "what this law changed" paragraphs. They are **drafts from background knowledge**, flagged `approved: false`, and shown to users labelled "Draft — not yet reviewed". The law that renamed the GST/HST credit is not yet linked. The CDCP's enabling authority wasn't identified, so it has no law link.
