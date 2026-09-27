"use client";

import type { Facts } from "@/lib/facts/schema";
import type { FactConflict, FactSource } from "@/lib/profile/merge";

/**
 * Client-only state between steps. Uses sessionStorage (cleared when the tab
 * closes) — nothing about the user's situation is stored on our servers.
 */
export interface FlowState {
  facts: Facts;
  detected_language: string | null;
  sensitive_data_ignored: boolean;
  evidence: { fact: string; quote: string }[];
  /** Where each confirmed value came from: the saved profile, or what they just said. */
  sources?: Partial<Record<keyof Facts, FactSource>>;
  /** Profile values that disagree with what they said, for the confirm screen to ask about. */
  conflicts?: FactConflict[];
}

const KEY = "bb.flow";

export function saveFlow(s: FlowState) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage disabled: flow still works within the page */
  }
}

export function loadFlow(): FlowState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FlowState) : null;
  } catch {
    return null;
  }
}

export function clearFlow() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem("bb.results");
  } catch {}
}
