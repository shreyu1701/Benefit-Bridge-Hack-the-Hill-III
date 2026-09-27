"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SituationInput } from "@/components/situation-input";
import { useLang } from "@/components/lang-provider";
import { loadProfileState, type ProfileState } from "@/lib/profile/client";

/** Step after onboarding: describe the situation in your own words (voice or text). */
export function DescribeView() {
  const lang = useLang();
  const [state, setState] = useState<ProfileState | null>(null);

  useEffect(() => {
    let alive = true;
    loadProfileState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const fr = lang === "fr";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
          {fr ? "Dites-nous ce qui se passe" : "Tell us what's going on"}
        </h1>
        <p className="mt-2 text-muted">
          {fr
            ? "Parlez ou écrivez dans n'importe quelle langue. Nous le comparerons à votre profil et vous demanderons de confirmer avant de vérifier quoi que ce soit."
            : "Speak or type in any language. We'll compare it with your profile and ask you to confirm before checking anything."}
        </p>
      </div>
      {state && !state.profile && (
        <p className="text-sm">
          {fr ? "Vous n'avez pas encore de profil. " : "You don't have a profile yet. "}
          <Link href="/onboarding" className="text-primary underline">
            {fr ? "Répondre à 5 courtes questions" : "Answer 5 short screens"}
          </Link>
        </p>
      )}
      {state ? <SituationInput profile={state.profile} /> : <p role="status">{fr ? "Chargement…" : "Loading…"}</p>}
    </div>
  );
}
