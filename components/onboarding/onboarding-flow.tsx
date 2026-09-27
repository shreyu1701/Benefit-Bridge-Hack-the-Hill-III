"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FactInput } from "@/components/fact-input";
import { useLang } from "@/components/lang-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Progress } from "@/components/ui/progress";
import { ONBOARDING_COPY, ONBOARDING_STEPS } from "@/lib/i18n/onboarding";
import { loadProfileState, saveProfileState, type ProfileState } from "@/lib/profile/client";
import { emptyProfile, ProfileSchema, type Profile, type ProfileKey } from "@/lib/profile/schema";

/**
 * Five short screens that build the profile. Every question has "Prefer not to
 * say" (= null, which the rules engine treats as unknown and never guesses).
 * Each screen is validated with ProfileSchema.pick(its fields).
 */
export function OnboardingFlow() {
  const lang = useLang();
  const c = ONBOARDING_COPY[lang];
  const router = useRouter();
  const [state, setState] = useState<ProfileState | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<ProfileKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    let alive = true;
    loadProfileState().then((s) => {
      if (!alive) return;
      setState(s);
      if (s.profile) setProfile(s.profile);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Move focus to the new screen's heading so keyboard and screen-reader users land at the top.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

  if (!state) return <p role="status">{lang === "fr" ? "Chargement…" : "Loading…"}</p>;

  const step = ONBOARDING_STEPS[stepIndex];
  const total = ONBOARDING_STEPS.length;
  const last = stepIndex === total - 1;

  const setField = (k: ProfileKey, v: Profile[ProfileKey]) => {
    setProfile((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validateStep(): boolean {
    const pick = Object.fromEntries(step.fields.map((f) => [f, true])) as Record<ProfileKey, true>;
    const values = Object.fromEntries(step.fields.map((f) => [f, profile[f]]));
    const r = ProfileSchema.pick(pick).safeParse(values);
    if (r.success) return true;
    const next: Partial<Record<ProfileKey, string>> = {};
    for (const issue of r.error.issues) next[issue.path[0] as ProfileKey] = c.invalid;
    setErrors(next);
    return false;
  }

  async function next() {
    if (!validateStep()) return;
    if (!last) return setStepIndex((i) => i + 1);
    setSaving(true);
    try {
      await saveProfileState(state!.signedIn, ProfileSchema.parse(profile));
      toast.success(state!.signedIn ? c.saved : c.savedGuest);
      router.push("/describe");
    } catch {
      toast.error(c.saveFailed);
      setSaving(false);
    }
  }

  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted" id="onboarding-step">{c.step(stepIndex + 1, total)}</p>
        <Progress value={((stepIndex + 1) / total) * 100} aria-labelledby="onboarding-step" />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
        className="space-y-6"
      >
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl sm:text-4xl tracking-tight outline-none">
            {step.title[lang]}
          </h1>
          <p className="mt-2 text-muted">{step.intro[lang]}</p>
        </div>

        {hasErrors && <Notice role="alert">{c.fixErrors}</Notice>}

        <div className="space-y-7">
          {step.fields.map((f) => (
            <FactInput
              key={`${step.id}-${f}`}
              idPrefix="ob"
              k={f}
              value={profile[f]}
              onChange={(v) => setField(f, v)}
              unknownLabel={c.preferNot}
              error={errors[f] ?? null}
            />
          ))}
        </div>

        <p className="text-sm text-muted">{state.signedIn ? c.privacySignedIn : c.privacyGuest}</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={saving} aria-busy={saving}>
            {saving ? c.saving : last ? c.finish : c.next}
          </Button>
          {stepIndex > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStepIndex((i) => i - 1)} disabled={saving}>
              {c.back}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
