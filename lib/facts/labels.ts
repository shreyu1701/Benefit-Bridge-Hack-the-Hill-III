import type { Facts } from "./schema";
import {
  EMPLOYMENT_STATUSES,
  HOUSING,
  INCOME_BANDS,
  LIFE_EVENTS,
  NEEDS,
  PROVINCES,
  RESIDENCY_STATUSES,
  STUDENT_STATUSES,
} from "./schema";
import type { UiLang } from "@/lib/i18n/messages";

type L = { en: string; fr: string };

/** Labels, plain-language help (tooltips) and follow-up questions for each fact. */
export const FACT_META: Record<keyof Facts, { label: L; question: L; help?: L }> = {
  province: { label: { en: "Province", fr: "Province" }, question: { en: "Which province or territory do you live in?", fr: "Dans quelle province ou quel territoire habitez-vous?" } },
  city: { label: { en: "City", fr: "Ville" }, question: { en: "Which city do you live in?", fr: "Dans quelle ville habitez-vous?" } },
  age: { label: { en: "Age", fr: "Âge" }, question: { en: "How old are you?", fr: "Quel âge avez-vous?" } },
  has_partner: {
    label: { en: "Partner", fr: "Conjoint" },
    question: { en: "Do you have a spouse or common-law partner?", fr: "Avez-vous un époux ou un conjoint de fait?" },
    help: { en: "Common-law means you've lived together for at least 12 months, or you have a child together.", fr: "Conjoint de fait : vous vivez ensemble depuis au moins 12 mois ou avez un enfant ensemble." },
  },
  children_ages: { label: { en: "Children's ages", fr: "Âge des enfants" }, question: { en: "Do you have children? How old are they?", fr: "Avez-vous des enfants? Quel âge ont-ils?" } },
  household_size: { label: { en: "People in household", fr: "Personnes dans le ménage" }, question: { en: "How many people live in your household, including you?", fr: "Combien de personnes vivent dans votre ménage, vous compris?" } },
  family_income_band: {
    label: { en: "Family income (per year)", fr: "Revenu familial (par année)" },
    question: { en: "About how much does your family earn in a year, after deductions?", fr: "Environ combien votre famille gagne-t-elle par année, après déductions?" },
    help: { en: "“Adjusted family net income”: your and your partner's net income from your tax returns (line 23600). A range is enough.", fr: "« Revenu familial net rajusté » : votre revenu net et celui de votre conjoint (ligne 23600). Une fourchette suffit." },
  },
  residency_status: { label: { en: "Status in Canada", fr: "Statut au Canada" }, question: { en: "What is your status in Canada?", fr: "Quel est votre statut au Canada?" } },
  years_in_canada: { label: { en: "Years in Canada", fr: "Années au Canada" }, question: { en: "How many years have you lived in Canada?", fr: "Depuis combien d'années vivez-vous au Canada?" } },
  employment_status: { label: { en: "Work", fr: "Travail" }, question: { en: "Do you work right now?", fr: "Travaillez-vous en ce moment?" } },
  disability: { label: { en: "Disability", fr: "Invalidité" }, question: { en: "Do you have a disability?", fr: "Avez-vous une invalidité?" } },
  disability_tax_credit: {
    label: { en: "Disability tax credit", fr: "Crédit d'impôt pour personnes handicapées" },
    question: { en: "Has the CRA approved you for the disability tax credit (DTC)?", fr: "L'ARC vous a-t-elle accordé le crédit d'impôt pour personnes handicapées (CIPH)?" },
    help: {
      en: "The DTC is approved by the Canada Revenue Agency using a form your doctor fills out (T2201). It's needed for the Canada Disability Benefit.",
      fr: "Le CIPH est accordé par l'Agence du revenu du Canada à partir d'un formulaire rempli par votre médecin (T2201). Il est requis pour la Prestation canadienne pour les personnes handicapées.",
    },
  },
  student_status: { label: { en: "Student", fr: "Études" }, question: { en: "Are you a student?", fr: "Êtes-vous aux études?" } },
  has_dental_insurance: {
    label: { en: "Dental insurance", fr: "Assurance dentaire" },
    question: { en: "Do you have dental insurance (through work, school, or a private plan)?", fr: "Avez-vous une assurance dentaire (travail, école ou régime privé)?" },
  },
  housing: { label: { en: "Housing", fr: "Logement" }, question: { en: "Do you rent or own your home?", fr: "Êtes-vous locataire ou propriétaire?" } },
  receives_social_assistance: {
    label: { en: "Ontario Works / ODSP", fr: "Ontario au travail / POSPH" },
    question: { en: "Do you get Ontario Works or ODSP now?", fr: "Recevez-vous Ontario au travail ou le POSPH?" },
  },
  files_taxes: {
    label: { en: "Filed taxes last year", fr: "Déclaration d'impôts l'an dernier" },
    question: { en: "Did you file a tax return last year?", fr: "Avez-vous produit une déclaration de revenus l'an dernier?" },
    help: {
      en: "Most benefits are paid through your tax return, even if you had no income. You can still file for past years.",
      fr: "La plupart des prestations passent par la déclaration de revenus, même sans revenu. Vous pouvez encore produire pour les années passées.",
    },
  },
  life_events: {
    label: { en: "What's happening", fr: "Ce qui se passe" },
    question: { en: "Has any of this happened recently?", fr: "Est-ce que l'une de ces situations vous arrive?" },
    help: { en: "This only helps us show the most relevant results first. It never changes whether you qualify.", fr: "Cela nous aide seulement à montrer d'abord les résultats les plus utiles. Cela ne change jamais votre admissibilité." },
  },
  needs: {
    label: { en: "Help with", fr: "Aide pour" },
    question: { en: "What would you like help with?", fr: "Pour quoi aimeriez-vous de l'aide?" },
    help: { en: "This only helps us show the most relevant results first. It never changes whether you qualify.", fr: "Cela nous aide seulement à montrer d'abord les résultats les plus utiles. Cela ne change jamais votre admissibilité." },
  },
};

export const ENUM_LABELS: Record<string, L> = {
  // residency
  citizen: { en: "Canadian citizen", fr: "Citoyen canadien" },
  permanent_resident: { en: "Permanent resident", fr: "Résident permanent" },
  protected_person: { en: "Protected person (refugee status granted)", fr: "Personne protégée (statut de réfugié accordé)" },
  refugee_claimant: { en: "Refugee claimant (waiting for a decision)", fr: "Demandeur d'asile (en attente)" },
  temporary_worker: { en: "Work permit", fr: "Permis de travail" },
  temporary_student: { en: "Study permit", fr: "Permis d'études" },
  visitor: { en: "Visitor", fr: "Visiteur" },
  other: { en: "Other", fr: "Autre" },
  // employment
  employed: { en: "Employed", fr: "Salarié" },
  self_employed: { en: "Self-employed", fr: "Travailleur autonome" },
  unemployed: { en: "Looking for work", fr: "À la recherche d'un emploi" },
  retired: { en: "Retired", fr: "Retraité" },
  not_working: { en: "Not working", fr: "Sans emploi" },
  // student
  none: { en: "Not a student", fr: "Pas aux études" },
  high_school: { en: "High school", fr: "École secondaire" },
  post_secondary_full_time: { en: "College/university, full-time", fr: "Collège/université, temps plein" },
  post_secondary_part_time: { en: "College/university, part-time", fr: "Collège/université, temps partiel" },
  // housing
  rent: { en: "Rent", fr: "Locataire" },
  own: { en: "Own", fr: "Propriétaire" },
  // life events
  lost_job: { en: "Lost a job", fr: "Perte d'emploi" },
  expecting_or_new_baby: { en: "Expecting or new baby", fr: "Bébé en route ou nouveau-né" },
  separated: { en: "Separated or divorced", fr: "Séparation ou divorce" },
  moved_recently: { en: "Moved recently", fr: "Déménagement récent" },
  started_school: { en: "Started school", fr: "Début des études" },
  retiring_soon: { en: "Retiring", fr: "Départ à la retraite" },
  death_in_family: { en: "Death in the family", fr: "Décès dans la famille" },
  new_to_canada: { en: "New to Canada", fr: "Nouvel arrivant au Canada" },
  caring_for_someone: { en: "Caring for someone", fr: "Proche aidant" },
  // needs
  rent_housing: { en: "Rent or housing", fr: "Loyer ou logement" },
  food: { en: "Food", fr: "Alimentation" },
  childcare: { en: "Child care", fr: "Garde d'enfants" },
  health_dental: { en: "Health or dental care", fr: "Santé ou soins dentaires" },
  disability_support: { en: "Disability support", fr: "Soutien aux personnes handicapées" },
  transit: { en: "Transit", fr: "Transport en commun" },
  income_support: { en: "Money to live on", fr: "Revenu de subsistance" },
  education_training: { en: "School or training", fr: "Études ou formation" },
  caregiving: { en: "Caregiving", fr: "Soins à un proche" },
  taxes_filing: { en: "Filing taxes", fr: "Déclaration de revenus" },
};

export const PROVINCE_LABELS: Record<string, L> = {
  AB: { en: "Alberta", fr: "Alberta" }, BC: { en: "British Columbia", fr: "Colombie-Britannique" }, MB: { en: "Manitoba", fr: "Manitoba" },
  NB: { en: "New Brunswick", fr: "Nouveau-Brunswick" }, NL: { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" },
  NS: { en: "Nova Scotia", fr: "Nouvelle-Écosse" }, NT: { en: "Northwest Territories", fr: "Territoires du Nord-Ouest" }, NU: { en: "Nunavut", fr: "Nunavut" },
  ON: { en: "Ontario", fr: "Ontario" }, PE: { en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" }, QC: { en: "Quebec", fr: "Québec" },
  SK: { en: "Saskatchewan", fr: "Saskatchewan" }, YT: { en: "Yukon", fr: "Yukon" },
};

export function incomeLabel(id: string, lang: UiLang): string {
  const b = INCOME_BANDS.find((x) => x.id === id);
  if (!b) return id;
  const fmt = (n: number) => n.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  if (b.id === "over_150k") return lang === "fr" ? `${fmt(b.min)} et plus` : `${fmt(b.min)} or more`;
  return `${fmt(b.min)} – ${fmt(b.max)}`;
}

export function formatFact(key: keyof Facts, value: Facts[keyof Facts], lang: UiLang): string | null {
  if (value === null || value === undefined) return null;
  const yes = lang === "fr" ? "Oui" : "Yes";
  const no = lang === "fr" ? "Non" : "No";
  switch (key) {
    case "province":
      return PROVINCE_LABELS[value as string]?.[lang] ?? String(value);
    case "family_income_band":
      return incomeLabel(value as string, lang);
    case "children_ages": {
      const a = value as number[];
      if (!a.length) return lang === "fr" ? "Aucun enfant" : "No children";
      return a.map((n) => (lang === "fr" ? `${n} an${n > 1 ? "s" : ""}` : `${n} yr`)).join(", ");
    }
    case "has_partner":
    case "disability":
    case "disability_tax_credit":
    case "has_dental_insurance":
    case "receives_social_assistance":
    case "files_taxes":
      return value ? yes : no;
    case "life_events":
    case "needs": {
      const a = value as string[];
      if (!a.length) return lang === "fr" ? "Rien de particulier" : "Nothing in particular";
      return a.map((v) => ENUM_LABELS[v]?.[lang] ?? v).join(", ");
    }
    case "years_in_canada":
      return `${Math.round((value as number) * 10) / 10}`;
    default:
      return ENUM_LABELS[value as string]?.[lang] ?? String(value);
  }
}

export const OPTIONS = {
  province: PROVINCES,
  residency_status: RESIDENCY_STATUSES,
  employment_status: EMPLOYMENT_STATUSES,
  student_status: STUDENT_STATUSES,
  housing: HOUSING,
  family_income_band: INCOME_BANDS.map((b) => b.id),
  life_events: LIFE_EVENTS,
  needs: NEEDS,
};
