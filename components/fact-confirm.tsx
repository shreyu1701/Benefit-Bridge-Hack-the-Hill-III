"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useLang, useT } from "@/components/lang-provider";
import { FactInput } from "@/components/fact-input";
import { FACT_META, formatFact } from "@/lib/facts/labels";
import { FACT_KEYS, emptyFacts, type Facts } from "@/lib/facts/schema";
import { loadProfileState, saveProfileState, type ProfileState } from "@/lib/profile/client";
import { sameValue } from "@/lib/profile/merge";
import { clearFlow, loadFlow, saveFlow, type FlowState } from "@/lib/session-state";
import { cn } from "@/lib/utils";

/**
 * Confirm the facts before any check runs. Each chip says where its value came
 * from; each disagreement between the profile and what they said is asked
 * about explicitly; and the confirmed facts can be saved back to the profile.
 */
export function FactConfirm() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [account, setAccount] = useState<ProfileState | null>(null);
  const [editing, setEditing] = useState<keyof Facts | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // sessionStorage is only readable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlow(loadFlow() ?? { facts: emptyFacts(), detected_language: null, sensitive_data_ignored: false, evidence: [] });
    let alive = true;
    loadProfileState().then((s) => alive && setAccount(s));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (editing) editorRef.current?.querySelector<HTMLElement>("input, select, button[role=radio]")?.focus();
  }, [editing]);

  if (!flow) return <p role="status" aria-live="polite">{t("common.loading")}</p>;

  const sources = flow.sources ?? {};
  const conflicts = flow.conflicts ?? [];
  const update = (next: FlowState) => {
    setFlow(next);
    saveFlow(next);
  };
  const set = (k: keyof Facts, v: Facts[keyof Facts]) =>
    update({ ...flow, facts: { ...flow.facts, [k]: v }, sources: { ...sources, [k]: "said" }, conflicts: conflicts.filter((c) => c.fact !== k) });
  const resolve = (k: keyof Facts, choice: "profile" | "said") => {
    const c = conflicts.find((x) => x.fact === k)!;
    update({
      ...flow,
      facts: { ...flow.facts, [k]: choice === "profile" ? c.profile_value : c.said_value },
      sources: { ...sources, [k]: choice },
      conflicts: conflicts.filter((x) => x.fact !== k),
    });
  };

  const known = FACT_KEYS.filter((k) => flow.facts[k] !== null);
  const unknown = FACT_KEYS.filter((k) => flow.facts[k] === null);
  const profile = account?.profile ?? null;
  const differsFromProfile = FACT_KEYS.some((k) => !sameValue(k, flow.facts[k], profile?.[k] ?? null));

  async function updateProfile() {
    if (!account) return;
    setSavingProfile(true);
    try {
      await saveProfileState(account.signedIn, flow!.facts);
      setAccount({ ...account, profile: flow!.facts });
      update({ ...flow!, sources: Object.fromEntries(known.map((k) => [k, "profile"])) });
      toast.success(account.signedIn ? t("confirm.profileUpdated") : t("confirm.profileUpdatedGuest"));
    } catch {
      toast.error(t("confirm.profileUpdateFailed"));
    } finally {
      setSavingProfile(false);
    }
  }

  const chip = (k: keyof Facts) => {
    const v = formatFact(k, flow.facts[k], lang);
    const src = v ? sources[k] : undefined;
    return (
      <li key={k}>
        <button
          type="button"
          onClick={() => setEditing(editing === k ? null : k)}
          aria-expanded={editing === k}
          aria-controls="fact-editor"
          className={cn(
            "inline-flex min-h-11 flex-col items-start rounded-2xl border px-3.5 py-1.5 text-left",
            v ? "border-primary bg-card" : "border-dashed border-border text-muted",
          )}
        >
          <span className="inline-flex items-center gap-2">
            <span className="font-semibold">{FACT_META[k].label[lang]}:</span>
            <span>{v ?? t("confirm.unknown")}</span>
            <Pencil aria-hidden size={14} />
          </span>
          {src && (
            <span className="text-xs text-muted">{src === "profile" ? t("confirm.fromProfile") : t("confirm.fromSaid")}</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{t("confirm.title")}</h1>
        <p className="mt-2 text-muted">{t("confirm.help")}</p>
      </div>
      {flow.detected_language && (
        <p className="text-sm">
          {t("confirm.detected")} <strong>{languageName(flow.detected_language, lang)}</strong>
        </p>
      )}
      {flow.sensitive_data_ignored && <Notice>{t("confirm.sensitive")}</Notice>}

      {conflicts.length > 0 && (
        <section aria-labelledby="conflicts-h" className="space-y-3">
          <h2 id="conflicts-h" className="text-xl font-semibold">{t("confirm.conflictTitle")}</h2>
          {conflicts.map((c) => (
            <div key={c.fact} className="space-y-3 rounded-2xl border border-warn-fg/30 bg-warn-bg p-4 text-warn-fg">
              <p className="font-semibold">{FACT_META[c.fact].label[lang]}</p>
              <p>
                {t("confirm.conflictProfile")} <strong>{formatFact(c.fact, c.profile_value, lang)}</strong>.{" "}
                {t("confirm.conflictSaid")} <strong>{formatFact(c.fact, c.said_value, lang)}</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="whitespace-normal text-left" onClick={() => resolve(c.fact, "profile")}>
                  {t("confirm.keepProfile")}: {formatFact(c.fact, c.profile_value, lang)}
                </Button>
                <Button size="sm" className="whitespace-normal text-left" onClick={() => resolve(c.fact, "said")}>
                  {t("confirm.useSaid")}: {formatFact(c.fact, c.said_value, lang)}
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      <ul className="flex flex-wrap gap-2" aria-label={t("confirm.title")}>
        {known.map(chip)}
      </ul>

      {editing && (
        <div id="fact-editor" ref={editorRef} className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <FactInput k={editing} value={flow.facts[editing]} onChange={(v) => set(editing, v)} />
          <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
            OK
          </Button>
        </div>
      )}

      {unknown.length > 0 && (
        <details className="rounded-2xl border border-border p-3" open={known.length === 0}>
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            {lang === "fr" ? `Ajouter d'autres renseignements (${unknown.length})` : `Add more details (${unknown.length})`}
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">{unknown.map(chip)}</ul>
        </details>
      )}

      {account && differsFromProfile && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <Badge variant="outline">{account.signedIn ? account.email ?? "" : lang === "fr" ? "Invité" : "Guest"}</Badge>
          <Button variant="outline" onClick={updateProfile} disabled={savingProfile} aria-busy={savingProfile}>
            {t("confirm.updateProfile")}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          size="lg"
          onClick={() => {
            setSubmitting(true);
            router.push("/results");
          }}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? t("common.loading") : t("confirm.submit")}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            clearFlow();
            router.push("/describe");
          }}
          disabled={submitting}
        >
          {t("confirm.back")}
        </Button>
      </div>
    </div>
  );
}

function languageName(code: string, ui: string) {
  try {
    return new Intl.DisplayNames([ui], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}
