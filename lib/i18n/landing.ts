import type { UiLang } from "./messages";

/**
 * Landing page copy (EN + FR). Every number here must be traceable to the app
 * or an official source: the seed data (data/programs.ts), published amounts
 * (data/amounts.ts), worker schedules (data/sources.ts, worker/index.ts) or the
 * 30-day staleness rule (lib/programs-repo.ts). Update this file when those change.
 *
 * `{n}` is replaced with the number of programs and `{programs}` with the list
 * of their names (both from data/programs.ts), so neither can go stale.
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
  /** The live example result next to the hero (components/landing/sample-result.tsx). */
  sample: { label: string; said: string; likely: string; more: string; note: string };
  examples: { heading: string; help: string; source: string; ids: string[] };
  start: StartCopy;
  trust: Item[];
  steps: { heading: string; items: Item[] };
  features: { heading: string; items: Item[] };
  audiences: { heading: string; items: Item[] };
  faq: { heading: string; items: { q: string; a: string }[] };
  levels: { federal: string; provincial: string; municipal: string };
  cta: { headline: string; body: string; button: string; fine: string };
}

const en: LandingCopy = {
  meta: {
    title: "Find Canadian benefits you're missing",
    description:
      "Describe your situation in any language. See which federal, Ontario and Toronto benefits you likely qualify for, about how much, and the official government page for each.",
  },
  hero: {
    badge: "Federal, Ontario and Toronto programs, from official sources",
    headline: "Find the support you're entitled to.",
    sub: "Describe your situation in your own words, in any language. We check it against {n} federal, Ontario and Toronto benefits and show which ones you may qualify for, with the official page for each.",
    cta: "Get started",
    ctaNote: "Five short screens, then your situation. No account, no SIN.",
  },
  sample: {
    label: "Example result",
    said: "What she told us",
    likely: "Likely eligible",
    more: "+ {n} more to check, with what to confirm for each",
    note: "Illustrative person. Worked out by the same rules and published formulas as your results.",
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
  steps: {
    heading: "How it works",
    items: [
      { title: "Tell us in your own words", body: "Type or press \"Speak\", in any language. \"I lost my job and I'm behind on rent\" is enough to start; there's no 40-question form." },
      { title: "Check what we understood", body: "Your details appear as tags you can edit (\"Age: 29\", \"Lost a job\"), so a misunderstanding never becomes a wrong answer." },
      { title: "See what you may qualify for", body: "Likely, possibly or not eligible, with the reasons, the official page and how to apply. Programs related to what you told us come first." },
    ],
  },
  features: {
    heading: "What you get",
    items: [
      { title: "An estimate for you", body: "Where the government publishes the formula, like for the Canada Child Benefit, we work out your amount from your income range and link the page it comes from." },
      { title: "Laws that may affect you", body: "If a bill changes something for people in your situation, your results say so, and whether it's law yet. A reviewer checks each one against the official bill first." },
      { title: "Only questions that matter", body: "We only ask what could change a result, and say how many: \"Your answer could change up to 3 results.\"" },
      { title: "Honest about what we don't know", body: "If the government doesn't publish a limit, or we're missing a detail, you see \"Possibly eligible\" and exactly what to check. We never guess." },
      { title: "Plain language, read aloud", body: "Every summary is written at a Grade 6 level, and one tap reads it to you." },
      { title: "A checklist to take with you", body: "Print or share one page with each benefit, its deadline and its official application link." },
    ],
  },
  audiences: {
    heading: "Who it's for",
    items: [
      { title: "Newcomers in their first years in Canada", body: "Find out which benefits your immigration status allows, such as the Canada Child Benefit's 18-month rule for temporary residents, without reading an English legal page." },
      { title: "Single parents and families with young kids", body: "See the Canada Child Benefit (up to $8,157 a year per child under 6), dental coverage and reduced child care fees side by side." },
      { title: "Seniors 65 and over", body: "Check Old Age Security, the Guaranteed Income Supplement and free dental care for Ontario seniors in one step." },
      { title: "People with disabilities", body: "See the Canada Disability Benefit (up to $204.20 a month) and what it needs first: approval for the disability tax credit." },
      { title: "Students and low-income workers", body: "See where OSAP, the Canada Workers Benefit and Toronto's Fair Pass fit, including a TTC fare of $2.10 instead of $3.30." },
      { title: "Settlement workers and caseworkers", body: "Run a client's situation in their own language and hand them a printed checklist with official links." },
    ],
  },
  faq: {
    heading: "Questions",
    items: [
      { q: "Is this an official government website?", a: "No. Benefit Bridge is an independent tool built only from official government sources, and every result links to the government page it relies on. Always confirm with the official program before you apply." },
      { q: "Does it tell me for sure that I'll get the money?", a: "No. It tells you whether you're likely eligible, possibly eligible or not eligible, and why. The government makes the final decision when you apply." },
      { q: "Which benefits does it cover?", a: "{n} benefits. {programs}" },
      { q: "How is my estimate worked out?", a: "From the formula and amounts on the official page, using the income range you gave. That's why it's shown as a range or an \"up to\" amount. The government works out the real amount from your tax return." },
      { q: "I don't live in Toronto. Can I still use it?", a: "Yes. Federal benefits apply anywhere in Canada, and Ontario benefits apply anywhere in Ontario. Only Fair Pass is Toronto-specific." },
      { q: "What languages can I use?", a: "You can type or speak in any language. The menus are in English and French. Results in other languages are translated automatically and labelled that way." },
      { q: "Do I need my SIN, pay stubs or immigration papers?", a: "No. We never ask for them. If you type a SIN by mistake, we remove it before your text is processed." },
      { q: "What happens to what I type or say?", a: "It's used once to understand your situation, then discarded. Your answers stay in your browser tab and disappear when you close it." },
      { q: "How do you know the information is current?", a: "A program automatically checks each government page every 6 to 24 hours. If a page changes, a person reviews the change before any eligibility rule is updated. Every result shows when it was last checked." },
      { q: "Why does a result say \"Possibly eligible\"?", a: "Either we're missing one detail, like your household size, or the government doesn't publish the exact limit. We tell you exactly what to check rather than guess." },
      { q: "Does it cover new laws that might affect me?", a: "Yes, in two ways. Your results list bills that a reviewer has confirmed may affect people in your situation. And the Recent laws page tracks every federal bill (refreshed every 30 minutes) and Ontario bill (every hour), labelling bills without royal assent \"Proposed — not yet law\"." },
      { q: "Do I need an account?", a: "No. Continue as a guest and your answers stay in your browser tab. Sign in with Google only if you want to save your profile; it is stored encrypted, and you can delete your account at any time." },
    ],
  },
  levels: { federal: "Federal", provincial: "Ontario", municipal: "City of Toronto" },
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
      "Décrivez votre situation dans n'importe quelle langue. Voyez à quelles prestations fédérales, ontariennes et torontoises vous avez probablement droit, environ combien, et la page gouvernementale officielle de chacune.",
  },
  hero: {
    badge: "Programmes fédéraux, ontariens et torontois, de sources officielles",
    headline: "Trouvez l'aide à laquelle vous avez droit.",
    sub: "Décrivez votre situation dans vos mots, dans n'importe quelle langue. Nous la comparons à {n} prestations fédérales, ontariennes et torontoises et vous montrons celles auxquelles vous pourriez avoir droit, avec la page officielle de chacune.",
    cta: "Commencer",
    ctaNote: "Cinq courts écrans, puis votre situation. Aucun compte, aucun NAS.",
  },
  sample: {
    label: "Exemple de résultat",
    said: "Ce qu'elle nous a dit",
    likely: "Probablement admissible",
    more: "+ {n} autres à vérifier, avec ce qu'il faut confirmer pour chacune",
    note: "Personne fictive. Calculé avec les mêmes règles et formules publiées que vos résultats.",
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
  steps: {
    heading: "Comment ça marche",
    items: [
      { title: "Dites-le dans vos mots", body: "Écrivez ou appuyez sur « Parler », dans n'importe quelle langue. « J'ai perdu mon emploi et je suis en retard sur mon loyer » suffit pour commencer; pas de formulaire de 40 questions." },
      { title: "Vérifiez ce que nous avons compris", body: "Vos renseignements s'affichent en étiquettes modifiables (« Âge : 29 », « Perte d'emploi »), pour qu'une erreur de compréhension ne devienne jamais une mauvaise réponse." },
      { title: "Voyez ce à quoi vous pourriez avoir droit", body: "Probablement, peut-être ou non admissible, avec les raisons, la page officielle et la façon de faire une demande. Les programmes liés à ce que vous avez dit passent en premier." },
    ],
  },
  features: {
    heading: "Ce que vous obtenez",
    items: [
      { title: "Une estimation pour vous", body: "Quand le gouvernement publie la formule, comme pour l'Allocation canadienne pour enfants, nous calculons votre montant selon votre tranche de revenu et citons la page d'où il vient." },
      { title: "Les lois qui pourraient vous toucher", body: "Si un projet de loi change quelque chose pour les personnes dans votre situation, vos résultats le disent, et précisent si c'est déjà une loi. Un réviseur vérifie chacun d'abord dans le projet officiel." },
      { title: "Seulement les questions utiles", body: "Nous ne demandons que ce qui peut changer un résultat, et disons combien : « Votre réponse pourrait changer jusqu'à 3 résultats. »" },
      { title: "Honnête sur ce que nous ignorons", body: "Si le gouvernement ne publie pas une limite ou s'il nous manque un détail, vous voyez « Peut-être admissible » et exactement quoi vérifier. Nous ne devinons jamais." },
      { title: "Langage simple, lu à voix haute", body: "Chaque résumé est écrit pour un niveau de 6e année, et un seul toucher vous le lit." },
      { title: "Une liste à emporter", body: "Imprimez ou partagez une page avec chaque prestation, son échéance et son lien de demande officiel." },
    ],
  },
  audiences: {
    heading: "Pour qui",
    items: [
      { title: "Les nouveaux arrivants au Canada", body: "Découvrez à quelles prestations votre statut vous donne droit, comme la règle des 18 mois de l'Allocation canadienne pour enfants pour les résidents temporaires, sans lire de texte juridique." },
      { title: "Les parents seuls et les familles avec jeunes enfants", body: "Voyez côte à côte l'Allocation canadienne pour enfants (jusqu'à 8 157 $ par an par enfant de moins de 6 ans), les soins dentaires et la réduction des frais de garde." },
      { title: "Les aînés de 65 ans et plus", body: "Vérifiez en une étape la Sécurité de la vieillesse, le Supplément de revenu garanti et les soins dentaires gratuits pour les aînés de l'Ontario." },
      { title: "Les personnes handicapées", body: "Voyez la Prestation canadienne pour les personnes handicapées (jusqu'à 204,20 $ par mois) et ce qu'il faut d'abord : le crédit d'impôt pour personnes handicapées." },
      { title: "Les étudiants et les travailleurs à faible revenu", body: "Voyez où se situent le RAFEO, l'Allocation canadienne pour les travailleurs et Fair Pass à Toronto, dont un tarif TTC de 2,10 $ au lieu de 3,30 $." },
      { title: "Les intervenants en établissement", body: "Analysez la situation d'une personne dans sa langue et remettez-lui une liste imprimée avec les liens officiels." },
    ],
  },
  faq: {
    heading: "Questions",
    items: [
      { q: "Est-ce un site officiel du gouvernement?", a: "Non. Benefit Bridge est un outil indépendant fondé uniquement sur des sources gouvernementales officielles, et chaque résultat renvoie à la page gouvernementale utilisée. Confirmez toujours auprès du programme officiel avant de faire une demande." },
      { q: "Est-ce que ça garantit que je recevrai l'argent?", a: "Non. L'outil indique si vous êtes probablement admissible, peut-être admissible ou non admissible, et pourquoi. Le gouvernement prend la décision finale lors de votre demande." },
      { q: "Quelles prestations sont couvertes?", a: "{n} prestations. {programs}" },
      { q: "Comment mon estimation est-elle calculée?", a: "À partir de la formule et des montants de la page officielle, selon la tranche de revenu que vous avez indiquée. C'est pourquoi elle s'affiche comme une fourchette ou un montant « jusqu'à ». Le gouvernement calcule le vrai montant à partir de votre déclaration de revenus." },
      { q: "Je n'habite pas à Toronto. Puis-je l'utiliser?", a: "Oui. Les prestations fédérales s'appliquent partout au Canada, et celles de l'Ontario partout en Ontario. Seul Fair Pass est propre à Toronto." },
      { q: "Quelles langues puis-je utiliser?", a: "Vous pouvez écrire ou parler dans n'importe quelle langue. Les menus sont en anglais et en français. Les résultats dans d'autres langues sont traduits automatiquement et indiqués comme tels." },
      { q: "Ai-je besoin de mon NAS, de talons de paie ou de papiers d'immigration?", a: "Non. Nous ne les demandons jamais. Si vous écrivez un NAS par erreur, nous le retirons avant de traiter votre texte." },
      { q: "Qu'advient-il de ce que j'écris ou dis?", a: "C'est utilisé une seule fois pour comprendre votre situation, puis supprimé. Vos réponses restent dans l'onglet de votre navigateur et disparaissent quand vous le fermez." },
      { q: "Comment savez-vous que l'information est à jour?", a: "Un programme vérifie automatiquement chaque page gouvernementale toutes les 6 à 24 heures. Si une page change, une personne examine le changement avant toute modification d'une règle d'admissibilité. Chaque résultat indique sa dernière vérification." },
      { q: "Pourquoi un résultat dit-il « Peut-être admissible »?", a: "Soit il nous manque un détail, comme la taille du ménage, soit le gouvernement ne publie pas la limite exacte. Nous vous disons exactement quoi vérifier au lieu de deviner." },
      { q: "Est-ce que ça couvre les nouvelles lois qui me touchent?", a: "Oui, de deux façons. Vos résultats indiquent les projets de loi qu'un réviseur a confirmés comme pouvant toucher les personnes dans votre situation. Et la page Lois récentes suit chaque projet de loi fédéral (actualisé toutes les 30 minutes) et ontarien (toutes les heures), en indiquant « Proposé — pas encore une loi » sans sanction royale." },
      { q: "Ai-je besoin d'un compte?", a: "Non. Continuez en tant qu'invité et vos réponses restent dans votre onglet. Connectez-vous avec Google seulement pour enregistrer votre profil : il est chiffré, et vous pouvez supprimer votre compte en tout temps." },
    ],
  },
  levels: { federal: "Fédéral", provincial: "Ontario", municipal: "Ville de Toronto" },
  cta: {
    headline: "Voyez ce que vous manquez avant la prochaine échéance",
    body: "Écrivez ou dites quelques phrases sur votre vie. Vous obtiendrez la liste des prestations fédérales, ontariennes et torontoises avec les liens officiels et les prochaines étapes.",
    button: "Commencer",
    fine: "Aucun compte · Aucun NAS · Toutes les langues · Pas un conseil juridique ou financier",
  },
};

export const LANDING: Record<UiLang, LandingCopy> = { en, fr };
