"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GoogleMark } from "@/components/google-mark";
import { useLang } from "@/components/lang-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FACT_META, formatFact } from "@/lib/facts/labels";
import { clearGuestProfile, loadProfileState, type ProfileState } from "@/lib/profile/client";
import { PROFILE_KEYS } from "@/lib/profile/schema";
import { clearFlow } from "@/lib/session-state";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    title: "Your profile",
    guest: "You're using Benefit Bridge as a guest. Your answers stay in this browser tab only.",
    signedIn: (e: string) => `Signed in as ${e}. Your profile is saved to your account, encrypted.`,
    empty: "No profile yet.",
    start: "Answer 5 short screens",
    edit: "Edit my profile",
    signIn: "Sign in with Google to save it",
    signOut: "Sign out",
    clear: "Clear my answers",
    cleared: "Your answers were cleared from this tab.",
    del: "Delete my account",
    delTitle: "Delete your account?",
    delBody: "This permanently deletes your saved profile and your account. It can't be undone. You can still use Benefit Bridge as a guest.",
    delConfirm: "Yes, delete everything",
    cancel: "Cancel",
    delFailed: "We couldn't delete your account. Please try again.",
    notSaid: "Prefer not to say",
  },
  fr: {
    title: "Votre profil",
    guest: "Vous utilisez Benefit Bridge en tant qu'invité. Vos réponses restent dans cet onglet seulement.",
    signedIn: (e: string) => `Connecté en tant que ${e}. Votre profil est enregistré dans votre compte, chiffré.`,
    empty: "Pas encore de profil.",
    start: "Répondre à 5 courts écrans",
    edit: "Modifier mon profil",
    signIn: "Se connecter avec Google pour l'enregistrer",
    signOut: "Se déconnecter",
    clear: "Effacer mes réponses",
    cleared: "Vos réponses ont été effacées de cet onglet.",
    del: "Supprimer mon compte",
    delTitle: "Supprimer votre compte?",
    delBody: "Cette action supprime définitivement votre profil enregistré et votre compte. Elle est irréversible. Vous pourrez toujours utiliser Benefit Bridge en tant qu'invité.",
    delConfirm: "Oui, tout supprimer",
    cancel: "Annuler",
    delFailed: "Impossible de supprimer votre compte. Veuillez réessayer.",
    notSaid: "Je préfère ne pas répondre",
  },
};

export function AccountView({ googleUrl }: { googleUrl: string | null }) {
  const lang = useLang();
  const c = COPY[lang];
  const router = useRouter();
  const [state, setState] = useState<ProfileState | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProfileState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return <p role="status">{lang === "fr" ? "Chargement…" : "Loading…"}</p>;

  async function deleteAccount() {
    setDeleting(true);
    try {
      const r = await fetch("/api/account", { method: "DELETE" });
      if (!r.ok) throw new Error();
      const { logoutUrl } = await r.json();
      clearFlow();
      clearGuestProfile();
      window.location.assign(logoutUrl); // full navigation: /auth/logout is a server redirect
    } catch {
      toast.error(c.delFailed);
      setDeleting(false);
    }
  }

  const p = state.profile;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{c.title}</h1>
        <p className="mt-2 text-muted">{state.signedIn ? c.signedIn(state.email ?? "") : c.guest}</p>
      </div>

      {p ? (
        <dl className="grid gap-x-6 gap-y-2 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
          {PROFILE_KEYS.map((k) => (
            <div key={k} className="flex flex-wrap gap-x-2">
              <dt className="font-semibold">{FACT_META[k].label[lang]}:</dt>
              <dd className={cn(p[k] === null && "text-muted")}>{formatFact(k, p[k], lang) ?? c.notSaid}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>{c.empty}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/onboarding" className={cn(buttonVariants({ size: "lg" }), "no-underline")}>
          {p ? c.edit : c.start}
        </Link>
        {!state.signedIn && googleUrl && (
          <a href={googleUrl} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "no-underline")}>
            <GoogleMark /> {c.signIn}
          </a>
        )}
        {!state.signedIn && p && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              clearGuestProfile();
              clearFlow();
              setState({ ...state, profile: null });
              toast.success(c.cleared);
              router.refresh();
            }}
          >
            {c.clear}
          </Button>
        )}
        {state.signedIn && (
          <a href="/auth/logout" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "no-underline")}>
            {c.signOut}
          </a>
        )}
      </div>

      {state.signedIn && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="lg">{c.del}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{c.delTitle}</DialogTitle>
              <DialogDescription>{c.delBody}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{c.cancel}</Button>
              </DialogClose>
              <Button variant="destructive" onClick={deleteAccount} disabled={deleting} aria-busy={deleting}>
                {c.delConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
