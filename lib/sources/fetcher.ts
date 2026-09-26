import { createHash } from "node:crypto";
import { DisallowedSourceError, isAllowedUrl } from "./allowlist";
import { isPathAllowed, parseRobots, type RobotsRules } from "./robots";

export const USER_AGENT =
  process.env.FETCH_USER_AGENT ??
  "BenefitBridgeBot/0.1 (+https://github.com/shreyu1701/Benefit-Bridge-Hack-the-Hill-III; benefit eligibility public-interest tool)";

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  body: string;
  contentType: string | null;
  lastModified: string | null;
  etag: string | null;
  fetchedAt: Date;
  notModified: boolean;
  error?: string;
}

export interface FetchOptions {
  etag?: string | null;
  lastModified?: string | null;
  /** Skip robots.txt check (only for documented machine-readable feeds/APIs). */
  skipRobots?: boolean;
  timeoutMs?: number;
}

export type FetchLike = typeof fetch;

/**
 * Polite, allowlisted HTTP client:
 *  - refuses any non-government URL (allowlist)
 *  - obeys robots.txt (cached per host for 24h) and Crawl-delay
 *  - identifies itself with a descriptive User-Agent
 *  - rate-limits per host (default ≥ 2s between requests)
 *  - uses conditional requests (ETag / Last-Modified)
 */
export class PoliteFetcher {
  private robots = new Map<string, { rules: RobotsRules; at: number }>();
  private lastHit = new Map<string, number>();

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly minIntervalMs = Number(process.env.FETCH_MIN_INTERVAL_MS ?? 2000),
    private readonly sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  private async robotsFor(origin: string): Promise<RobotsRules> {
    const cached = this.robots.get(origin);
    if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.rules;
    let rules: RobotsRules = { allow: [], disallow: [], crawlDelaySec: null };
    try {
      const res = await this.fetchImpl(origin + "/robots.txt", { headers: { "User-Agent": USER_AGENT } });
      if (res.ok) rules = parseRobots(await res.text(), USER_AGENT);
    } catch {
      /* unreachable robots.txt → treat as allow-all, per RFC 9309 §2.3.1.3 for 4xx; network errors retried next time */
    }
    this.robots.set(origin, { rules, at: Date.now() });
    return rules;
  }

  private async throttle(host: string, crawlDelaySec: number | null) {
    const gap = Math.max(this.minIntervalMs, (crawlDelaySec ?? 0) * 1000);
    const last = this.lastHit.get(host) ?? 0;
    const wait = last + gap - Date.now();
    if (wait > 0) await this.sleep(wait);
    this.lastHit.set(host, Date.now());
  }

  async get(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
    if (!isAllowedUrl(url)) throw new DisallowedSourceError(url);
    const u = new URL(url);
    const fetchedAt = new Date();
    const base = { url, finalUrl: url, fetchedAt, contentType: null, lastModified: null, etag: null, notModified: false };

    let crawlDelay: number | null = null;
    if (!opts.skipRobots) {
      const rules = await this.robotsFor(u.origin);
      crawlDelay = rules.crawlDelaySec;
      if (!isPathAllowed(rules, u.pathname + u.search)) {
        return { ...base, status: 0, ok: false, body: "", error: "disallowed_by_robots_txt" };
      }
    }
    await this.throttle(u.host, crawlDelay);

    const headers: Record<string, string> = { "User-Agent": USER_AGENT, Accept: "text/html,application/json,application/xml;q=0.9,*/*;q=0.8" };
    if (opts.etag) headers["If-None-Match"] = opts.etag;
    if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

    try {
      const res = await this.fetchImpl(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      // A redirect off the allowlist is treated as a failure, never followed into.
      if (res.url && !isAllowedUrl(res.url)) {
        return { ...base, finalUrl: res.url, status: res.status, ok: false, body: "", error: "redirected_off_allowlist" };
      }
      const body = res.status === 304 ? "" : await res.text();
      return {
        url,
        finalUrl: res.url || url,
        status: res.status,
        ok: res.ok || res.status === 304,
        body,
        contentType: res.headers.get("content-type"),
        lastModified: res.headers.get("last-modified"),
        etag: res.headers.get("etag"),
        fetchedAt,
        notModified: res.status === 304,
      };
    } catch (e) {
      return { ...base, status: 0, ok: false, body: "", error: (e as Error).message };
    }
  }
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
