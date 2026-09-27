/**
 * UI strings. English and French are maintained by hand; every key must exist
 * in both (enforced by the type). Other languages are handled by on-the-fly
 * machine translation of RESULTS only, clearly labelled as such.
 */
const en = {
  "app.name": "Benefit Bridge",
  "app.tagline":
    "Find government benefits you may qualify for — explained in plain language.",
  "nav.landing": "Home",
  "nav.account": "My profile",
  "nav.login": "Log in",
  "nav.logout": "Log out",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",
  "footer.independent":
    "Independent tool. Not affiliated with the Government of Canada. The final decision on any benefit is made by the program. This is not legal or financial advice.",
  "nav.home": "Find benefits",
  "nav.laws": "Recent laws",
  "nav.insights": "Missed benefits",
  "nav.privacy": "Privacy",
  "nav.admin": "Review queue",
  "nav.language": "Français",
  disclaimer:
    "This is not legal or financial advice. Results are estimates based on official government sources. Always confirm with the official program before you decide anything.",
  skip: "Skip to main content",

  "home.title": "Tell us about your situation",
  "home.help":
    "Write or say it in your own words, in any language. For example: “I'm a single mom in Toronto with 2 kids under 6. I work part-time and came to Canada 2 years ago.”",
  "home.placeholder": "Describe your situation…",
  "home.privacy":
    "We don't save what you type or say. Please don't include your SIN, exact income, or document numbers.",
  "home.submit": "Find my benefits",
  "home.working": "Understanding your situation…",
  "home.manual": "Or fill in a short form instead",
  "home.record": "Speak",
  "home.stop": "Stop recording",
  "home.transcribing": "Turning your voice into text…",
  "home.voiceUnavailable":
    "Voice input isn't available right now. You can type instead.",
  "home.llmUnavailable":
    "Automatic understanding is unavailable right now. Please fill in the short form.",
  "home.llmQuota":
    "Automatic understanding has reached its daily limit. You can check with your profile below, or try again later.",
  "home.llmFailed":
    "We couldn't understand that automatically. Try saying it a different way, or check with your profile below.",

  "confirm.title": "Is this right?",
  "confirm.help":
    "Check what we understood. Tap any item to change it. Anything left as “Not sure” won't be guessed.",
  "confirm.submit": "Find my benefits",
  "confirm.unknown": "Not sure",
  "confirm.detected": "We detected your language:",
  "confirm.sensitive":
    "We ignored personal numbers you included (like a SIN). You never need to share them here.",
  "confirm.back": "Start over",
  "confirm.fromProfile": "From your profile",
  "confirm.fromSaid": "From what you said",
  "confirm.conflictTitle": "Which is right?",
  "confirm.conflictProfile": "Your profile says",
  "confirm.conflictSaid": "You just said",
  "confirm.keepProfile": "Keep my profile",
  "confirm.useSaid": "Use what I said",
  "confirm.updateProfile": "Update my profile",
  "confirm.profileUpdated": "Profile updated",
  "confirm.profileUpdatedGuest": "Profile updated in this browser tab",
  "confirm.profileUpdateFailed": "We couldn't update your profile.",

  "results.title": "Benefits you may qualify for",
  "results.followups": "A few quick questions could change your results",
  "results.level.federal": "Federal (Government of Canada)",
  "results.level.provincial": "Provincial (Ontario)",
  "results.level.municipal": "City (Toronto)",
  "results.likely": "Likely eligible",
  "results.possibly": "Possibly eligible",
  "results.not": "Not eligible",
  "results.why": "Why you likely qualify",
  "results.check": "What to check",
  "results.because": "Why not",
  "results.also": "Also required",
  "results.amount": "How much",
  "results.deadlines": "Deadlines",
  "results.apply": "How to apply",
  "results.official": "Official page",
  "results.details": "Details and the law behind it",
  "results.listen": "Listen",
  "results.stopListening": "Stop",
  "results.lastVerified": "Last verified",
  "results.sourceChanged": "Source last changed",
  "results.never": "not yet verified",
  "results.needsVerification":
    "Needs verification — the official page changed or couldn't be reached. Check the official page before relying on this.",
  "results.unverified":
    "Not yet checked by a reviewer against the current official page. Confirm the details on the official page.",
  "results.source": "source",
  "results.stale": "May be out of date — last checked more than 30 days ago.",
  "results.pending":
    "The official page recently changed. A reviewer is checking it.",
  "results.showNot": "Show programs you don't qualify for",
  "results.none": "We couldn't find any matches with what you told us.",
  "results.checklist": "Print or share my benefits checklist",
  "results.machineTranslated":
    "Translated automatically from English. The English and French versions are the reference.",
  "results.noData":
    "We don't have enough verified information for this part — check the official page.",
  "results.edit": "Edit my answers",
  "results.mentioned": "Because you mentioned",
  "results.mentionedNote": "programs related to it are listed first in each section. This never changes whether you qualify.",
  "results.matches": "Related to",
  "results.uncovered": "Our list doesn't have a program for this yet:",
  "results.uncoveredLink": "See all Government of Canada benefits",

  "personas.title": "How this affects people like you",
  "personas.label":
    "Illustrative example — not a real person. Based on the same verified rules.",

  "laws.title": "Recent laws and bills",
  "laws.help":
    "Federal and Ontario bills, updated automatically from Parliament and the Legislative Assembly.",
  "laws.proposed": "Proposed — not yet law",
  "laws.assent": "Royal assent",
  "laws.assentNote":
    "Passed into law. It may not be in effect yet — check when this takes effect.",
  "laws.recentAssent": "Recently became law",
  "laws.stage": "Current stage",
  "laws.who": "Who is affected",
  "laws.timeline": "Timeline",
  "laws.summaryPending":
    "Plain-language summary coming soon. Read the official page for now.",
  "laws.machineSummary":
    "Summary written by AI from the official text. Check the official page for the exact wording.",
  "laws.programs": "Programs linked to this law",
  "laws.federal": "Federal",
  "laws.ontario": "Ontario",
  "laws.all": "All",
  "laws.empty": "No bills loaded yet. The feed updates automatically.",
  "laws.detectedAt": "detected",

  "program.law": "The law behind it",
  "program.whatChanged": "What this law changed",
  "program.draft": "Draft — not yet reviewed",
  "program.noLaw": "We haven't linked this program to a specific law yet.",

  "checklist.title": "My benefits checklist",
  "checklist.print": "Print",
  "checklist.share": "Share",
  "checklist.copied": "Link copied",
  "checklist.empty": "No results yet. Start from the home page.",

  "q.answer": "Answer",
  "q.skip": "Skip",
  "q.couldChangeOne": "Your answer could change 1 result.",
  "q.couldChangeMany": "Your answer could change up to {n} results.",
  "q.more": "More questions",
  "results.updating": "Updating your results…",
  "results.changed": "Updated:",
  "results.noChange": "Updated. Your answer didn't change any result.",
  "common.yes": "Yes",
  "common.no": "No",
  "common.loading": "Loading…",
  "common.error": "Something went wrong. Please try again.",
  "common.retry": "Try again",
} as const;

export type MessageKey = keyof typeof en;

const fr: Record<MessageKey, string> = {
  "app.name": "Benefit Bridge",
  "app.tagline":
    "Trouvez les prestations gouvernementales auxquelles vous pourriez avoir droit — expliquées simplement.",
  "nav.landing": "Accueil",
  "nav.account": "Mon profil",
  "nav.login": "Se connecter",
  "nav.logout": "Se déconnecter",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",
  "footer.independent":
    "Outil indépendant, non affilié au gouvernement du Canada. La décision finale sur toute prestation revient au programme. Ceci n'est pas un conseil juridique ou financier.",
  "nav.home": "Trouver des prestations",
  "nav.laws": "Lois récentes",
  "nav.insights": "Prestations manquées",
  "nav.privacy": "Confidentialité",
  "nav.admin": "File de révision",
  "nav.language": "English",
  disclaimer:
    "Ceci n'est pas un conseil juridique ou financier. Les résultats sont des estimations fondées sur des sources gouvernementales officielles. Confirmez toujours auprès du programme officiel.",
  skip: "Passer au contenu principal",

  "home.title": "Parlez-nous de votre situation",
  "home.help":
    "Écrivez ou dites-le dans vos mots, dans n'importe quelle langue. Par exemple : « Je suis une mère seule à Toronto avec 2 enfants de moins de 6 ans. Je travaille à temps partiel et je suis arrivée au Canada il y a 2 ans. »",
  "home.placeholder": "Décrivez votre situation…",
  "home.privacy":
    "Nous ne conservons pas ce que vous écrivez ou dites. N'incluez pas votre NAS, votre revenu exact ni vos numéros de documents.",
  "home.submit": "Trouver mes prestations",
  "home.working": "Analyse de votre situation…",
  "home.manual": "Ou remplissez plutôt un court formulaire",
  "home.record": "Parler",
  "home.stop": "Arrêter l'enregistrement",
  "home.transcribing": "Transcription de votre voix…",
  "home.voiceUnavailable":
    "L'entrée vocale n'est pas disponible pour le moment. Vous pouvez écrire.",
  "home.llmUnavailable":
    "La compréhension automatique n'est pas disponible. Veuillez remplir le court formulaire.",
  "home.llmQuota":
    "La compréhension automatique a atteint sa limite quotidienne. Vous pouvez vérifier avec votre profil ci-dessous ou réessayer plus tard.",
  "home.llmFailed":
    "Nous n'avons pas pu comprendre automatiquement. Reformulez, ou vérifiez avec votre profil ci-dessous.",

  "confirm.title": "Est-ce exact?",
  "confirm.help":
    "Vérifiez ce que nous avons compris. Touchez un élément pour le modifier. Ce qui reste « Je ne sais pas » ne sera pas deviné.",
  "confirm.submit": "Trouver mes prestations",
  "confirm.unknown": "Je ne sais pas",
  "confirm.detected": "Langue détectée :",
  "confirm.sensitive":
    "Nous avons ignoré les numéros personnels inclus (comme un NAS). Vous n'avez jamais besoin de les fournir ici.",
  "confirm.back": "Recommencer",
  "confirm.fromProfile": "De votre profil",
  "confirm.fromSaid": "De ce que vous avez dit",
  "confirm.conflictTitle": "Laquelle est juste?",
  "confirm.conflictProfile": "Votre profil indique",
  "confirm.conflictSaid": "Vous venez de dire",
  "confirm.keepProfile": "Garder mon profil",
  "confirm.useSaid": "Utiliser ce que j'ai dit",
  "confirm.updateProfile": "Mettre à jour mon profil",
  "confirm.profileUpdated": "Profil mis à jour",
  "confirm.profileUpdatedGuest": "Profil mis à jour dans cet onglet",
  "confirm.profileUpdateFailed": "Impossible de mettre à jour votre profil.",

  "results.title": "Prestations auxquelles vous pourriez avoir droit",
  "results.followups":
    "Quelques questions rapides pourraient changer vos résultats",
  "results.level.federal": "Fédéral (gouvernement du Canada)",
  "results.level.provincial": "Provincial (Ontario)",
  "results.level.municipal": "Municipal (Toronto)",
  "results.likely": "Probablement admissible",
  "results.possibly": "Peut-être admissible",
  "results.not": "Non admissible",
  "results.why": "Pourquoi vous êtes probablement admissible",
  "results.check": "À vérifier",
  "results.because": "Pourquoi pas",
  "results.also": "Également requis",
  "results.amount": "Montant",
  "results.deadlines": "Échéances",
  "results.apply": "Comment faire une demande",
  "results.official": "Page officielle",
  "results.details": "Détails et loi applicable",
  "results.listen": "Écouter",
  "results.stopListening": "Arrêter",
  "results.lastVerified": "Dernière vérification",
  "results.sourceChanged": "Dernière modification de la source",
  "results.never": "pas encore vérifié",
  "results.needsVerification":
    "À vérifier — la page officielle a changé ou était inaccessible. Consultez la page officielle.",
  "results.unverified":
    "Pas encore vérifié par un réviseur par rapport à la page officielle actuelle. Confirmez les détails sur la page officielle.",
  "results.source": "source",
  "results.stale":
    "Peut-être périmé — dernière vérification il y a plus de 30 jours.",
  "results.pending":
    "La page officielle a récemment changé. Un réviseur la vérifie.",
  "results.showNot":
    "Afficher les programmes auxquels vous n'êtes pas admissible",
  "results.none": "Aucun résultat avec les renseignements fournis.",
  "results.checklist": "Imprimer ou partager ma liste de prestations",
  "results.machineTranslated":
    "Traduit automatiquement de l'anglais. Les versions anglaise et française font foi.",
  "results.noData":
    "Nous n'avons pas assez de renseignements vérifiés pour ce point — consultez la page officielle.",
  "results.edit": "Modifier mes réponses",
  "results.mentioned": "Comme vous avez mentionné",
  "results.mentionedNote": "les programmes liés sont présentés en premier dans chaque section. Cela ne change jamais votre admissibilité.",
  "results.matches": "Lié à",
  "results.uncovered": "Notre liste n'a pas encore de programme pour :",
  "results.uncoveredLink": "Voir toutes les prestations du gouvernement du Canada",

  "personas.title": "Ce que cela signifie pour des gens comme vous",
  "personas.label":
    "Exemple illustratif — pas une vraie personne. Fondé sur les mêmes règles vérifiées.",

  "laws.title": "Lois et projets de loi récents",
  "laws.help":
    "Projets de loi fédéraux et ontariens, mis à jour automatiquement à partir du Parlement et de l'Assemblée législative.",
  "laws.proposed": "Proposé — pas encore une loi",
  "laws.assent": "Sanction royale",
  "laws.assentNote":
    "Adoptée. Elle n'est peut-être pas encore en vigueur — vérifiez sa date d'entrée en vigueur.",
  "laws.recentAssent": "Devenue loi récemment",
  "laws.stage": "Étape actuelle",
  "laws.who": "Personnes touchées",
  "laws.timeline": "Chronologie",
  "laws.summaryPending":
    "Résumé en langage simple à venir. Consultez la page officielle.",
  "laws.machineSummary":
    "Résumé rédigé par IA à partir du texte officiel. Consultez la page officielle pour le libellé exact.",
  "laws.programs": "Programmes liés à cette loi",
  "laws.federal": "Fédéral",
  "laws.ontario": "Ontario",
  "laws.all": "Tous",
  "laws.empty":
    "Aucun projet de loi chargé. Le flux se met à jour automatiquement.",
  "laws.detectedAt": "détecté",

  "program.law": "La loi applicable",
  "program.whatChanged": "Ce que cette loi a changé",
  "program.draft": "Brouillon — pas encore révisé",
  "program.noLaw":
    "Nous n'avons pas encore lié ce programme à une loi précise.",

  "checklist.title": "Ma liste de prestations",
  "checklist.print": "Imprimer",
  "checklist.share": "Partager",
  "checklist.copied": "Lien copié",
  "checklist.empty": "Aucun résultat. Commencez à la page d'accueil.",

  "q.answer": "Répondre",
  "q.skip": "Passer",
  "q.couldChangeOne": "Votre réponse pourrait changer 1 résultat.",
  "q.couldChangeMany": "Votre réponse pourrait changer jusqu'à {n} résultats.",
  "q.more": "Plus de questions",
  "results.updating": "Mise à jour de vos résultats…",
  "results.changed": "Mis à jour :",
  "results.noChange": "Mis à jour. Votre réponse n'a changé aucun résultat.",
  "common.yes": "Oui",
  "common.no": "Non",
  "common.loading": "Chargement…",
  "common.error": "Une erreur s'est produite. Veuillez réessayer.",
  "common.retry": "Réessayer",
};

export const MESSAGES = { en, fr } as const;
export type UiLang = keyof typeof MESSAGES;
export const UI_LANGS: UiLang[] = ["en", "fr"];

export function t(lang: UiLang, key: MessageKey): string {
  return MESSAGES[lang][key] ?? en[key];
}
