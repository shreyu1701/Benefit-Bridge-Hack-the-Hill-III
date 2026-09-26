import { XMLParser } from "fast-xml-parser";

export interface GazetteItem {
  guid: string;
  part: "II" | "III";
  title: string;
  link: string;
  description: string | null;
  published_at: string | null;
}

/** Parse a Canada Gazette RSS 2.0 feed (Part II regulations / Part III Acts). */
export function parseGazetteRss(xml: string, part: "II" | "III"): GazetteItem[] {
  const doc = new XMLParser({ ignoreAttributes: false, textNodeName: "#text" }).parse(xml);
  const channel = doc?.rss?.channel;
  if (!channel) throw new Error("Gazette feed: not an RSS 2.0 document");
  const items = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];
  const text = (v: unknown): string | null =>
    v == null ? null : typeof v === "object" ? String((v as Record<string, unknown>)["#text"] ?? "") : String(v);
  return items
    .map((it: Record<string, unknown>) => {
      const link = text(it.link) ?? "";
      const pub = text(it.pubDate);
      const d = pub ? new Date(pub) : null;
      return {
        guid: text(it.guid) || link,
        part,
        title: (text(it.title) ?? "").trim(),
        link,
        description: text(it.description),
        published_at: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      };
    })
    .filter((i: GazetteItem) => i.guid && i.title);
}
