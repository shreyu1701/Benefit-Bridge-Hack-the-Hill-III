# Test fixtures

| File | What it is |
|------|------------|
| `legisinfo-bills.synthetic.v1.json`, `.v2.json` | **Synthetic**. They use the LEGISinfo field names documented in `docs/SOURCE_VERIFICATION.md`, but the bills are made up ("Example … Act"). They exist so the ingestion tests run offline. |
| `legisinfo-bills.real.json` | **Real** feed, saved by `npm run fixtures:refresh`. It is not committed yet because the build environment could not reach `www.parl.ca` (egress blocked). Once it exists, `tests/legisinfo.test.ts` also runs every parser and invariant test against it. |
| `canada-ca-page.v1.html`, `.v2.html` | **Synthetic** pages that copy the canada.ca Web Experience Toolkit (WET) layout: a `<main>` element plus `<dl id="wb-dtmd">` holding `<time property="dateModified">`. The page-watch tests use them. `npm run fixtures:refresh` saves a real CCB page next to them. |

Commit the real fixtures with the date you fetched them so the tests keep up with format drift.
