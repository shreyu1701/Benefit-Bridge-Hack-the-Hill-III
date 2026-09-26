import type { BillEvent, BillStore, NormalizedBill, StoredBill } from "@/lib/ingest/bills";

export class MemoryBillStore implements BillStore {
  bills = new Map<string, NormalizedBill & { id: number }>();
  events: (BillEvent & { bill_id: number })[] = [];
  private nextId = 1;

  private key(j: string, p: number, s: number, n: string) {
    return `${j}|${p}|${s}|${n}`;
  }
  async getBill(j: string, p: number, s: number, n: string): Promise<StoredBill | null> {
    const b = this.bills.get(this.key(j, p, s, n));
    return b ? { id: b.id, current_stage: b.current_stage, status_en: b.status_en, content_hash: b.content_hash, royal_assent_at: b.royal_assent_at } : null;
  }
  async upsertBill(b: NormalizedBill): Promise<number> {
    const k = this.key(b.jurisdiction, b.parliament, b.session, b.bill_number);
    const id = this.bills.get(k)?.id ?? this.nextId++;
    this.bills.set(k, { ...b, id });
    return id;
  }
  async insertEvents(billId: number, events: BillEvent[]): Promise<number> {
    let n = 0;
    for (const e of events) {
      if (this.events.some((x) => x.bill_id === billId && x.stage === e.stage && x.occurred_at === e.occurred_at)) continue;
      this.events.push({ ...e, bill_id: billId });
      n++;
    }
    return n;
  }
  async recordedStages(billId: number) {
    return new Set(this.events.filter((e) => e.bill_id === billId).map((e) => e.stage));
  }
  byNumber(n: string) {
    return [...this.bills.values()].find((b) => b.bill_number === n);
  }
  eventsFor(n: string) {
    const b = this.byNumber(n);
    return this.events.filter((e) => e.bill_id === b?.id);
  }
}
