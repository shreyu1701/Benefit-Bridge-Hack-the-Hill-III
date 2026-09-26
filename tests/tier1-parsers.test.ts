import { describe, expect, it } from "vitest";
import { parseOlaBillList, parseOlaBillPage } from "@/lib/ingest/ontario-bills";
import { parseGazetteRss } from "@/lib/ingest/gazette";
import { isPathAllowed, parseRobots } from "@/lib/sources/robots";
import { isAllowedUrl } from "@/lib/sources/allowlist";
import { PoliteFetcher } from "@/lib/sources/fetcher";

// Synthetic markup (structure-only). Replace with saved real pages via `npm run fixtures:refresh`.
const OLA_LIST = `<html><body><main><table>
<tr><td><a href="/en/legislative-business/bills/parliament-44/session-1/bill-12">Bill 12</a></td><td><a href="/en/legislative-business/bills/parliament-44/session-1/bill-12">Example Affordability Act, 2026</a></td></tr>
<tr><td><a href="/en/legislative-business/bills/parliament-44/session-1/bill-7">Example Housing Act, 2025</a></td></tr>
<tr><td><a href="/en/legislative-business/bills/parliament-43/session-2/bill-99">Old bill</a></td></tr>
<tr><td><a href="/en/members/current">Members</a></td></tr>
</table></main></body></html>`;

const OLA_BILL = `<html><body><main><h1>Bill 12, Example Affordability Act, 2026</h1>
<table><thead><tr><th>Date</th><th>Bill stage</th><th>Event</th><th>Outcome</th></tr></thead><tbody>
<tr><td>March 3, 2026</td><td>First Reading</td><td>Debate</td><td>Carried</td></tr>
<tr><td>April 14, 2026</td><td>Second Reading</td><td>Vote</td><td>Carried</td></tr>
<tr><td>June 4, 2026</td><td>Royal Assent</td><td></td><td>Received</td></tr>
</tbody></table>
<p>Chapter 9 of the Statutes of Ontario, 2026</p></main></body></html>`;

describe("ola.org parsing", () => {
  it("detects the latest parliament/session from links (no hardcoding)", () => {
    const r = parseOlaBillList(OLA_LIST);
    expect(r).toMatchObject({ parliament: 44, session: 1 });
    expect(r.bills.map((b) => b.number).sort()).toEqual(["12", "7"]);
    expect(r.bills.find((b) => b.number === "12")!.title).toBe("Example Affordability Act, 2026");
  });

  it("fails loudly when no bill links are found", () => {
    expect(() => parseOlaBillList("<html><body>Maintenance</body></html>")).toThrow(/structure changed/);
  });

  it("builds a timeline and recognises royal assent + statute chapter", () => {
    const ref = parseOlaBillList(OLA_LIST).bills.find((b) => b.number === "12")!;
    const { bill, events } = parseOlaBillPage(OLA_BILL, ref);
    expect(events.map((e) => e.stage)).toEqual(["first_reading_debate_carried", "second_reading_vote_carried", "royal_assent"]);
    expect(bill.royal_assent_at).toBe(events[2].occurred_at);
    expect(bill.statute_ref).toBe("S.O. 2026, c. 9");
    expect(bill.source_url).toBe("https://www.ola.org/en/legislative-business/bills/parliament-44/session-1/bill-12");
  });
});

describe("Canada Gazette RSS", () => {
  it("parses RSS 2.0 items", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Canada Gazette Part II</title>
      <item><title>Example Regulations Amending the Example Regulations (synthetic)</title><link>https://gazette.gc.ca/rp-pr/p2/2026/2026-09-23/html/sor-dors123-eng.html</link>
      <pubDate>Wed, 23 Sep 2026 00:00:00 -0400</pubDate><guid>sor-2026-123</guid><description>Registered regulation</description></item>
      </channel></rss>`;
    const items = parseGazetteRss(xml, "II");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ guid: "sor-2026-123", part: "II", published_at: "2026-09-23T04:00:00.000Z" });
  });
});

describe("source rules", () => {
  it("allowlist accepts government domains and rejects everything else", () => {
    expect(isAllowedUrl("https://www.canada.ca/en/services/benefits.html")).toBe(true);
    expect(isAllowedUrl("https://laws-lois.justice.gc.ca/eng/XML/Legis.xml")).toBe(true);
    expect(isAllowedUrl("https://www.parl.ca/legisinfo/en/bills/json")).toBe(true);
    expect(isAllowedUrl("https://www.ola.org/en/legislative-business/bills/current")).toBe(true);
    expect(isAllowedUrl("https://www.toronto.ca/x")).toBe(true);
    expect(isAllowedUrl("https://canada.ca.evil.com/")).toBe(false);
    expect(isAllowedUrl("https://notcanada.ca/")).toBe(false);
    expect(isAllowedUrl("http://www.canada.ca/")).toBe(false); // https only
    expect(isAllowedUrl("https://www.cbc.ca/news")).toBe(false);
  });

  it("robots.txt: longest match wins, specific UA group preferred", () => {
    const rules = parseRobots(
      `User-agent: *\nDisallow: /search\nAllow: /search/help\nCrawl-delay: 5\n\nUser-agent: OtherBot\nDisallow: /`,
      "BenefitBridgeBot/0.1",
    );
    expect(isPathAllowed(rules, "/search?q=x")).toBe(false);
    expect(isPathAllowed(rules, "/search/help")).toBe(true);
    expect(isPathAllowed(rules, "/en/bills")).toBe(true);
    expect(rules.crawlDelaySec).toBe(5);
  });

  it("fetcher refuses non-allowlisted URLs and honours robots.txt", async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nDisallow: /private", { status: 200 });
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;
    const f = new PoliteFetcher(fake, 0);
    await expect(f.get("https://example.com/")).rejects.toThrow(/non-allowlisted/);
    const blocked = await f.get("https://www.canada.ca/private/page");
    expect(blocked.error).toBe("disallowed_by_robots_txt");
    expect(calls).not.toContain("https://www.canada.ca/private/page");
  });
});
