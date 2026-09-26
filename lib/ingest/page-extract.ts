import * as cheerio from "cheerio";
import { createTwoFilesPatch } from "diff";
import { sha256 } from "@/lib/sources/fetcher";

/**
 * Extract the main content of an official page as normalized text, plus the
 * page's own "Date modified".
 *
 * - canada.ca (Web Experience Toolkit): <main>, and
 *   <dl id="wb-dtmd"><dt>Date modified:</dt><dd><time property="dateModified">YYYY-MM-DD</time></dd></dl>
 * - ontario.ca / toronto.ca: <main> or [role=main]; "Updated:" / "Last updated" text or meta tags.
 *
 * The date line is removed from the hashed text, so a page that is re-published
 * without changing its content does not create a review; the date itself is
 * stored separately on the snapshot.
 */
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDate(s: string | undefined | null): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) {
    return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const DATE_LINE = /^(date modified|updated|last updated|date de modification|mis à jour|mise à jour)\s*:?\s*/i;

export interface ExtractedPage {
  title: string | null;
  text: string;
  hash: string;
  dateModified: string | null;
}

export function extractPage(html: string): ExtractedPage {
  const $ = cheerio.load(html);

  let dateModified =
    parseDate($('time[property="dateModified"]').first().attr("datetime") ?? $('time[property="dateModified"]').first().text()) ??
    parseDate($('meta[name="dcterms.modified"]').attr("content")) ??
    parseDate($('meta[property="article:modified_time"]').attr("content"));

  $("script, style, noscript, template, svg, iframe, form[role=search], nav, header, footer, aside, .gc-subway, #wb-lng, .pagedetails, #wb-info").remove();

  const root = $("main").first().length ? $("main").first() : $('[role="main"]').first().length ? $('[role="main"]').first() : $("body");

  // Date sometimes lives inside <main> (e.g. "Updated: March 3, 2026").
  if (!dateModified) {
    root.find("p, span, dd, div, time").each((_, el) => {
      const txt = $(el).text().trim();
      if (txt.length < 60 && DATE_LINE.test(txt)) {
        dateModified = parseDate(txt.replace(DATE_LINE, ""));
        if (dateModified) return false;
      }
    });
  }
  root.find("#wb-dtmd").remove();

  // Preserve block structure as lines so diffs are readable.
  root.find("br").replaceWith("\n");
  root.find("p, li, h1, h2, h3, h4, h5, h6, tr, dt, dd, div, section, table, ul, ol, blockquote, summary, details, caption").each((_, el) => {
    $(el).append("\n");
  });
  root.find("td, th").each((_, el) => {
    $(el).append(" | ");
  });

  const text = root
    .text()
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").replace(/(\s*\|\s*)+$/, "").trim())
    .filter((l) => l && !(l.length < 60 && DATE_LINE.test(l)))
    .join("\n");

  return { title: $("title").first().text().trim() || null, text, hash: sha256(text), dateModified };
}

export function unifiedDiff(url: string, before: string, after: string): string {
  return createTwoFilesPatch(url + " (previous)", url + " (current)", before + "\n", after + "\n", "", "", { context: 2 });
}
