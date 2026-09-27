import type { ProfileKey } from "@/lib/profile/schema";
import type { UiLang } from "./messages";

/** The five onboarding screens: which profile fields each one asks, and their copy. */
export interface OnboardingStep {
  id: "location" | "you" | "household" | "income" | "other";
  fields: ProfileKey[];
  title: Record<UiLang, string>;
  intro: Record<UiLang, string>;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "location",
    fields: ["province", "city"],
    title: { en: "Where do you live?", fr: "Où habitez-vous?" },
    intro: {
      en: "Some programs are only for people in Ontario or Toronto.",
      fr: "Certains programmes sont réservés à l'Ontario ou à Toronto.",
    },
  },
  {
    id: "you",
    fields: ["age", "residency_status", "years_in_canada"],
    title: { en: "About you", fr: "À propos de vous" },
    intro: {
      en: "Age and status in Canada decide many benefits. We never ask for documents.",
      fr: "L'âge et le statut au Canada déterminent de nombreuses prestations. Nous ne demandons jamais de documents.",
    },
  },
  {
    id: "household",
    fields: ["has_partner", "children_ages", "household_size"],
    title: { en: "Your household", fr: "Votre ménage" },
    intro: {
      en: "Who lives with you changes what you can get.",
      fr: "Les personnes qui vivent avec vous changent ce à quoi vous avez droit.",
    },
  },
  {
    id: "income",
    fields: ["family_income_band", "employment_status", "student_status"],
    title: { en: "Income and work", fr: "Revenu et travail" },
    intro: {
      en: "A range is enough. We never ask for your exact income.",
      fr: "Une fourchette suffit. Nous ne demandons jamais votre revenu exact.",
    },
  },
  {
    id: "other",
    fields: [
      "files_taxes",
      "has_dental_insurance",
      "disability",
      "housing",
      "receives_social_assistance",
    ],
    title: { en: "A few last things", fr: "Quelques dernières questions" },
    intro: {
      en: "Most benefits are paid through your tax return, so that question matters most.",
      fr: "La plupart des prestations passent par la déclaration de revenus : cette question compte le plus.",
    },
  },
];

export const ONBOARDING_COPY: Record<
  UiLang,
  {
    preferNot: string;
    step: (n: number, total: number) => string;
    back: string;
    next: string;
    finish: string;
    saving: string;
    saved: string;
    savedGuest: string;
    saveFailed: string;
    fixErrors: string;
    invalid: string;
    privacyGuest: string;
    privacySignedIn: string;
  }
> = {
  en: {
    preferNot: "Prefer not to say",
    step: (n, total) => `Step ${n} of ${total}`,
    back: "Back",
    next: "Next",
    finish: "Save and continue",
    saving: "Saving…",
    saved: "Profile saved to your account",
    savedGuest: "Saved in this browser tab only",
    saveFailed: "We couldn't save your profile. Please try again.",
    fixErrors: "Please check the answer marked below.",
    invalid:
      'This answer doesn\'t look right. Check it, or choose "Prefer not to say".',
    privacyGuest:
      "You're a guest: your answers stay in this browser tab and disappear when you close it.",
    privacySignedIn:
      "Your answers are saved to your account, encrypted. You can delete them any time.",
  },
  fr: {
    preferNot: "Je préfère ne pas répondre",
    step: (n, total) => `Étape ${n} sur ${total}`,
    back: "Retour",
    next: "Suivant",
    finish: "Enregistrer et continuer",
    saving: "Enregistrement…",
    saved: "Profil enregistré dans votre compte",
    savedGuest: "Enregistré dans cet onglet seulement",
    saveFailed: "Impossible d'enregistrer votre profil. Veuillez réessayer.",
    fixErrors: "Veuillez vérifier la réponse indiquée ci-dessous.",
    invalid:
      "Cette réponse semble incorrecte. Vérifiez-la ou choisissez « Je préfère ne pas répondre ».",
    privacyGuest:
      "Vous êtes invité : vos réponses restent dans cet onglet et disparaissent quand vous le fermez.",
    privacySignedIn:
      "Vos réponses sont enregistrées dans votre compte, chiffrées. Vous pouvez les supprimer en tout temps.",
  },
};

export const ENTRY_COPY: Record<
  UiLang,
  {
    title: string;
    intro: string;
    google: string;
    googleNote: string;
    guest: string;
    guestNote: string;
    authOff: string;
    or: string;
  }
> = {
  en: {
    title: "How do you want to start?",
    intro:
      "Both ways get the same results. Signing in only lets you come back to your answers later.",
    google: "Sign in with Google",
    googleNote:
      "Your profile is saved to your account, encrypted. Delete it any time.",
    guest: "Continue as guest",
    guestNote:
      "Nothing is saved. Your answers stay in this browser tab until you close it.",
    authOff:
      "Sign-in isn't set up on this server, so you can continue as a guest.",
    or: "or",
  },
  fr: {
    title: "Comment voulez-vous commencer?",
    intro:
      "Les deux options donnent les mêmes résultats. La connexion permet seulement de retrouver vos réponses plus tard.",
    google: "Se connecter avec Google",
    googleNote:
      "Votre profil est enregistré dans votre compte, chiffré. Supprimez-le en tout temps.",
    guest: "Continuer en tant qu'invité",
    guestNote:
      "Rien n'est enregistré. Vos réponses restent dans cet onglet jusqu'à sa fermeture.",
    authOff:
      "La connexion n'est pas configurée sur ce serveur : vous pouvez continuer en tant qu'invité.",
    or: "ou",
  },
};
