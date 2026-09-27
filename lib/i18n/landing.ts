import type { UiLang } from "./messages";

/**
 * Landing page copy (EN + FR). Every number here must be traceable to the app
 * or an official source: the seed data (data/programs.ts), worker schedules
 * (data/sources.ts, worker/index.ts) or the 30-day staleness rule
 * (lib/programs-repo.ts). Update this file when those change.
 */
type Item = { title: string; body: string };

export interface StartCopy {
  label: string;
  placeholder: string;
  anyLanguage: string;
  tryLabel: string;
  examples: string[];
  profileOnly: string;
}

export interface LandingCopy {
  meta: { title: string; description: string };
  hero: { badge: string; headline: string; sub: string; cta: string; ctaNote: string };
  examples: { heading: string; help: string; source: string; ids: string[] };
  start: StartCopy;
  trust: Item[];
  features: { heading: string; items: Item[] };
  audiences: { heading: string; items: Item[] };
  faq: { heading: string; items: { q: string; a: string }[] };
  cta: { headline: string; body: string; button: string; fine: string };
}

const en: LandingCopy = {
  meta: {
    title: "Find Canadian benefits you're missing",
    description:
      "Describe your situation in any language. See which federal, Ontario and Toronto benefits you likely qualify for, with the official government page for each.",
  },
  hero: {
    badge: "Federal, Ontario and Toronto programs, from official sources",
    headline: "Find the support you're entitled to.",
    sub: "Describe your situation in your own words, in any language. We check it against 11 federal, Ontario and Toronto benefits and show which ones you may qualify for, with the official page for each.",
    cta: "Get started",
    ctaNote: "Five short screens, then describe your situation. No account needed.",
  },
  start: {
    label: "Tell us about your situation",
    placeholder: "e.g. I moved to Ottawa last month for school and I work part-time. My rent is $1,400…",
    anyLanguage: "Any language works",
    tryLabel: "Try:",
    examples: ["I just moved to Ontario as a student", "Single parent in Toronto, 2 kids under 6", "I'm 67 and live alone in Toronto"],
    profileOnly: "Skip this and check with my profile only",
  },
  examples: {
    heading: "Three benefits people often miss",
    help: "Amounts and rules come from the official pages linked below.",
    source: "Official page",
    ids: ["ca-ccb", "ca-cdcp", "to-fair-pass"],
  },
  trust: [
    { title: "Official sources only", body: "Every result links to the federal, Ontario or Toronto page it came from." },
    { title: "Checked every 6 to 24 hours", body: "Each program shows when a person last verified it and when the official page last changed." },
    { title: "Private by default", body: "No account needed. We never store what you type or say. Saving a profile is optional and encrypted." },
    { title: "Plain language", body: "Rules and bills explained in a few sentences, not forty pages." },
  ],
  features: {
    heading: "How it works",
    items: [
      { title: "Talk or type your situation", body: "Describe your household in your own words, or press \"Speak\" and say it. You don't have to fill out a 40-question form to get started." },
      { title: "Confirm what we understood first", body: "Your details appear as editable tags (\"Age: 29\", \"Children: 2 yr, 4 yr\"), so a misunderstanding never becomes a wrong answer." },
      { title: "At most 3 follow-up questions", body: "We only ask about facts that could change a result, like dental insurance or years in Canada. Nothing else." },
      { title: "Results sorted by federal, Ontario and Toronto", body: "You see what's likely, what's possible and what's ruled out, each with its amount, deadline and how to apply." },
      { title: "Grade 6 plain language, read aloud", body: "Every summary is written simply, and one tap reads it to you." },
      { title: "Freshness dates on every result", body: "Each card shows when a reviewer last checked it and when the government page last changed. A result not rechecked in 30 days is flagged \"may be out of date\"." },
      { title: "New laws, explained as they happen", body: "Federal bill status is refreshed every 30 minutes, and Ontario bills every hour. Bills without royal assent are labelled \"Proposed — not yet law\"." },
      { title: "A printable checklist of your next steps", body: "Print or share one page listing each benefit, its deadline and its official application link." },
    ],
  },
  audiences: {
    heading: "Who it's for",
    items: [
      { title: "Newcomers in their first years in Canada", body: "Find out which benefits your immigration status allows, such as the Canada Child Benefit's 18-month rule for temporary residents, without reading an English legal page." },
      { title: "Single parents and families with young kids", body: "See the Canada Child Benefit (up to $8,157 a year per child under 6), dental coverage and reduced child care fees side by side." },
      { title: "Seniors 65 and over", body: "Check Old Age Security and the Guaranteed Income Supplement against the 10-years-in-Canada-after-18 rule in one step." },
      { title: "Students and low-income workers", body: "See where OSAP, the Canada Workers Benefit and Toronto's Fair Pass fit, including a TTC fare of $2.10 instead of $3.30." },
      { title: "Settlement workers, caseworkers and family helpers", body: "Run a client's situation in their own language and hand them a printed checklist with official links." },
    ],
  },
  faq: {
    heading: "Questions",
    items: [
      { q: "Is this an official government website?", a: "No. Benefit Bridge is an independent tool built only from official government sources, and every result links to the government page it relies on. Always confirm with the official program before you apply." },
      { q: "Does it tell me for sure that I'll get the money?", a: "No. It tells you whether you're likely eligible, possibly eligible or not eligible, and why. The government makes the final decision when you apply." },
      { q: "Which benefits does it cover?", a: "11 benefits. Federal: Canada Child Benefit, Canada Groceries and Essentials Benefit (formerly the GST/HST credit), Canadian Dental Care Plan, Canada Workers Benefit, Old Age Security, Guaranteed Income Supplement. Ontario: Ontario Trillium Benefit, child care fee reduction, OSAP, Ontario Works. City of Toronto: Fair Pass." },
      { q: "I don't live in Toronto. Can I still use it?", a: "Yes. Federal benefits apply anywhere in Canada, and Ontario benefits apply anywhere in Ontario. Only Fair Pass is Toronto-specific." },
      { q: "What languages can I use?", a: "You can type or speak in any language. The menus are in English and French. Results in other languages are translated automatically and labelled that way." },
      { q: "Do I need my SIN, pay stubs or immigration papers?", a: "No. We never ask for them. If you type a SIN by mistake, we remove it before your text is processed." },
      { q: "What happens to what I type or say?", a: "It's used once to understand your situation, then discarded. Your answers stay in your browser tab and disappear when you close it." },
      { q: "How do you know the information is current?", a: "A program automatically checks each government page every 6 to 24 hours. If a page changes, a person reviews the change before any eligibility rule is updated. Every result shows when it was last checked." },
      { q: "Why does a result say \"Possibly eligible\"?", a: "Either we're missing one detail, like your household size, or the government doesn't publish the exact limit. We tell you exactly what to check rather than guess." },
      { q: "Why did the GST/HST credit change names?", a: "As of July 2026, the CRA calls it the Canada Groceries and Essentials Benefit. We use the current name and mention the old one." },
      { q: "Does it cover new laws that might affect me?", a: "Yes. The Recent laws page tracks federal and Ontario bills, shows each bill's stage and timeline, and highlights bills that recently became law." },
      { q: "Do I need an account?", a: "No. Continue as a guest and your answers stay in your browser tab. Sign in with Google only if you want to save your profile; it is stored encrypted, and you can delete your account at any time." },
    ],
  },
  cta: {
    headline: "See what you may be missing before the next deadline",
    body: "Write or say a few sentences about your life. You'll get a list of federal, Ontario and Toronto benefits with official links and what to do next.",
    button: "Get started",
    fine: "No account · No SIN · Any language · Not legal or financial advice",
  },
};

const fr: LandingCopy = {
  meta: {
    title: "Trouvez les prestations canadiennes que vous manquez",
    description:
      "Décrivez votre situation dans n'importe quelle langue. Voyez à quelles prestations fédérales, ontariennes et torontoises vous avez probablement droit, avec la page gouvernementale officielle de chacune.",
  },
  hero: {
    badge: "Programmes fédéraux, ontariens et torontois, de sources officielles",
    headline: "Trouvez l'aide à laquelle vous avez droit.",
    sub: "Décrivez votre situation dans vos mots, dans n'importe quelle langue. Nous la comparons à 11 prestations fédérales, ontariennes et torontoises et vous montrons celles auxquelles vous pourriez avoir droit, avec la page officielle de chacune.",
    cta: "Commencer",
    ctaNote: "Cinq courts écrans, puis décrivez votre situation. Aucun compte requis.",
  },
  start: {
    label: "Parlez-nous de votre situation",
    placeholder: "ex. Je suis arrivé à Ottawa le mois dernier pour mes études et je travaille à temps partiel. Mon loyer est de 1 400 $…",
    anyLanguage: "Toutes les langues fonctionnent",
    tryLabel: "Essayez :",
    examples: ["Je viens d'arriver en Ontario pour étudier", "Parent seul à Toronto, 2 enfants de moins de 6 ans", "J'ai 67 ans et je vis seul à Toronto"],
    profileOnly: "Passer et vérifier avec mon profil seulement",
  },
  examples: {
    heading: "Trois prestations souvent oubliées",
    help: "Les montants et les règles viennent des pages officielles ci-dessous.",
    source: "Page officielle",
    ids: ["ca-ccb", "ca-cdcp", "to-fair-pass"],
  },
  trust: [
    { title: "Sources officielles seulement", body: "Chaque résultat renvoie à la page fédérale, ontarienne ou torontoise d'où il vient." },
    { title: "Vérifié toutes les 6 à 24 heures", body: "Chaque programme indique sa dernière vérification par une personne et la dernière modification de la page officielle." },
    { title: "Confidentiel par défaut", body: "Aucun compte requis. Nous ne conservons jamais ce que vous écrivez ou dites. Enregistrer un profil est facultatif et chiffré." },
    { title: "Langage simple", body: "Règles et projets de loi expliqués en quelques phrases, pas en quarante pages." },
  ],
  features: {
    heading: "Comment ça marche",
    items: [
      { title: "Parlez ou écrivez votre situation", body: "Décrivez votre ménage dans vos mots, ou appuyez sur « Parler ». Pas besoin de remplir un formulaire de 40 questions pour commencer." },
      { title: "Confirmez d'abord ce que nous avons compris", body: "Vos renseignements s'affichent en étiquettes modifiables (« Âge : 29 », « Enfants : 2 ans, 4 ans »), pour qu'une erreur de compréhension ne devienne jamais une mauvaise réponse." },
      { title: "Au plus 3 questions de suivi", body: "Nous ne posons que les questions qui peuvent changer un résultat, comme l'assurance dentaire ou les années au Canada." },
      { title: "Résultats classés : fédéral, Ontario, Toronto", body: "Vous voyez ce qui est probable, possible ou exclu, avec le montant, l'échéance et la façon de faire une demande." },
      { title: "Langage simple de 6e année, lu à voix haute", body: "Chaque résumé est écrit simplement, et un seul toucher vous le lit." },
      { title: "Des dates de mise à jour sur chaque résultat", body: "Chaque fiche indique la dernière vérification par un réviseur et la dernière modification de la page gouvernementale. Un résultat non revérifié depuis 30 jours est signalé « peut-être périmé »." },
      { title: "Les nouvelles lois, expliquées en temps réel", body: "Le statut des projets de loi fédéraux est actualisé toutes les 30 minutes, et celui de l'Ontario toutes les heures. Sans sanction royale, un projet est indiqué « Proposé — pas encore une loi »." },
      { title: "Une liste imprimable de vos prochaines étapes", body: "Imprimez ou partagez une page avec chaque prestation, son échéance et son lien de demande officiel." },
    ],
  },
  audiences: {
    heading: "Pour qui",
    items: [
      { title: "Les nouveaux arrivants au Canada", body: "Découvrez à quelles prestations votre statut vous donne droit, comme la règle des 18 mois de l'Allocation canadienne pour enfants pour les résidents temporaires, sans lire de texte juridique." },
      { title: "Les parents seuls et les familles avec jeunes enfants", body: "Voyez côte à côte l'Allocation canadienne pour enfants (jusqu'à 8 157 $ par an par enfant de moins de 6 ans), les soins dentaires et la réduction des frais de garde." },
      { title: "Les aînés de 65 ans et plus", body: "Vérifiez en une étape la Sécurité de la vieillesse et le Supplément de revenu garanti selon la règle des 10 ans au Canada après 18 ans." },
      { title: "Les étudiants et les travailleurs à faible revenu", body: "Voyez où se situent le RAFEO, l'Allocation canadienne pour les travailleurs et Fair Pass à Toronto, dont un tarif TTC de 2,10 $ au lieu de 3,30 $." },
      { title: "Les intervenants en établissement et aidants", body: "Analysez la situation d'une personne dans sa langue et remettez-lui une liste imprimée avec les liens officiels." },
    ],
  },
  faq: {
    heading: "Questions",
    items: [
      { q: "Est-ce un site officiel du gouvernement?", a: "Non. Benefit Bridge est un outil indépendant fondé uniquement sur des sources gouvernementales officielles, et chaque résultat renvoie à la page gouvernementale utilisée. Confirmez toujours auprès du programme officiel avant de faire une demande." },
      { q: "Est-ce que ça garantit que je recevrai l'argent?", a: "Non. L'outil indique si vous êtes probablement admissible, peut-être admissible ou non admissible, et pourquoi. Le gouvernement prend la décision finale lors de votre demande." },
      { q: "Quelles prestations sont couvertes?", a: "11 prestations. Fédéral : Allocation canadienne pour enfants, Prestation canadienne pour l'épicerie et les produits essentiels (anciennement le crédit pour la TPS/TVH), Régime canadien de soins dentaires, Allocation canadienne pour les travailleurs, Sécurité de la vieillesse, Supplément de revenu garanti. Ontario : Prestation Trillium de l'Ontario, réduction des frais de garde, RAFEO, Ontario au travail. Ville de Toronto : Fair Pass." },
      { q: "Je n'habite pas à Toronto. Puis-je l'utiliser?", a: "Oui. Les prestations fédérales s'appliquent partout au Canada, et celles de l'Ontario partout en Ontario. Seul Fair Pass est propre à Toronto." },
      { q: "Quelles langues puis-je utiliser?", a: "Vous pouvez écrire ou parler dans n'importe quelle langue. Les menus sont en anglais et en français. Les résultats dans d'autres langues sont traduits automatiquement et indiqués comme tels." },
      { q: "Ai-je besoin de mon NAS, de talons de paie ou de papiers d'immigration?", a: "Non. Nous ne les demandons jamais. Si vous écrivez un NAS par erreur, nous le retirons avant de traiter votre texte." },
      { q: "Qu'advient-il de ce que j'écris ou dis?", a: "C'est utilisé une seule fois pour comprendre votre situation, puis supprimé. Vos réponses restent dans l'onglet de votre navigateur et disparaissent quand vous le fermez." },
      { q: "Comment savez-vous que l'information est à jour?", a: "Un programme vérifie automatiquement chaque page gouvernementale toutes les 6 à 24 heures. Si une page change, une personne examine le changement avant toute modification d'une règle d'admissibilité. Chaque résultat indique sa dernière vérification." },
      { q: "Pourquoi un résultat dit-il « Peut-être admissible »?", a: "Soit il nous manque un détail, comme la taille du ménage, soit le gouvernement ne publie pas la limite exacte. Nous vous disons exactement quoi vérifier au lieu de deviner." },
      { q: "Pourquoi le crédit pour la TPS/TVH a-t-il changé de nom?", a: "Depuis juillet 2026, l'ARC l'appelle la Prestation canadienne pour l'épicerie et les produits essentiels. Nous utilisons le nouveau nom et mentionnons l'ancien." },
      { q: "Est-ce que ça couvre les nouvelles lois qui me touchent?", a: "Oui. La page Lois récentes suit les projets de loi fédéraux et ontariens, montre l'étape et la chronologie de chacun et met en évidence ceux qui sont récemment devenus des lois." },
      { q: "Ai-je besoin d'un compte?", a: "Non. Continuez en tant qu'invité et vos réponses restent dans votre onglet. Connectez-vous avec Google seulement pour enregistrer votre profil : il est chiffré, et vous pouvez supprimer votre compte en tout temps." },
    ],
  },
  cta: {
    headline: "Voyez ce que vous manquez avant la prochaine échéance",
    body: "Écrivez ou dites quelques phrases sur votre vie. Vous obtiendrez la liste des prestations fédérales, ontariennes et torontoises avec les liens officiels et les prochaines étapes.",
    button: "Commencer",
    fine: "Aucun compte · Aucun NAS · Toutes les langues · Pas un conseil juridique ou financier",
  },
};

export const LANDING: Record<UiLang, LandingCopy> = { en, fr };
