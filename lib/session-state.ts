"use client";

import type { Facts } from "@/lib/facts/schema";

/**
 * Client-only state between steps. Uses sessionStorage (cleared when the tab
 * closes) — nothing about the user's situation is stored on our servers.
 */
export interface FlowState {
  facts: Facts;
  detected_language: string | null;
  sensitive_data_ignored: boolean;
  evidence: { fact: string; quote: string }[];
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
