import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Privacy" };

const CONTENT = {
  en: {
    title: "Privacy, in plain language",
    items: [
      ["You don't need an account.", "You can use Benefit Bridge without signing up or giving your name."],
      ["We don't keep what you type or say.", "Your description and any voice recording are used once to understand your situation, then thrown away. We don't save them in our database or logs."],
      ["Who else sees it.", "To understand your words and to read results aloud, your text is sent to Google (Gemini) and your voice to ElevenLabs. They process it for us. We send only what's needed, and we remove anything that looks like a SIN or a document number first."],
      ["What stays on your device.", "Your answers are kept in your browser tab (session storage) so you can move between steps. They are deleted when you close the tab."],
      ["What we count.", "When someone matches a program, we count it anonymously: only the program, the province or city, and the date. Nothing about you. We only publish totals of 10 or more."],
      ["If you choose to save results.", "If you sign in and save, we store only your answers (like “age 34” or an income range), encrypted. Never your words or voice. You can delete them at any time."],
      ["We never ask for", "your Social Insurance Number, your exact income, or immigration document numbers. Ranges are enough."],
      ["Where data is kept.", "Our servers and database are in Canada (Toronto)."],
      ["Your rights.", "Under Canada's privacy law (PIPEDA), you can ask what we hold about you and ask us to correct or delete it."],
    ],
  },
  fr: {
    title: "La confidentialité, en termes simples",
    items: [
      ["Aucun compte nécessaire.", "Vous pouvez utiliser Benefit Bridge sans vous inscrire ni donner votre nom."],
      ["Nous ne gardons pas ce que vous écrivez ou dites.", "Votre description et tout enregistrement vocal servent une seule fois à comprendre votre situation, puis sont supprimés. Rien n'est enregistré dans notre base de données ni dans nos journaux."],
      ["Qui d'autre y a accès.", "Pour comprendre vos mots et lire les résultats à voix haute, votre texte est envoyé à Google (Gemini) et votre voix à ElevenLabs, qui les traitent pour nous. Nous retirons d'abord tout ce qui ressemble à un NAS ou à un numéro de document."],
      ["Ce qui reste sur votre appareil.", "Vos réponses sont gardées dans l'onglet de votre navigateur pour passer d'une étape à l'autre. Elles sont effacées quand vous fermez l'onglet."],
      ["Ce que nous comptons.", "Quand une personne correspond à un programme, nous le comptons de façon anonyme : seulement le programme, la province ou la ville, et la date. Nous ne publions que des totaux de 10 ou plus."],
      ["Si vous choisissez d'enregistrer.", "Si vous vous connectez et enregistrez, nous gardons seulement vos réponses (comme « 34 ans » ou une fourchette de revenu), chiffrées. Jamais vos mots ni votre voix. Vous pouvez les supprimer en tout temps."],
      ["Nous ne demandons jamais", "votre numéro d'assurance sociale, votre revenu exact ni vos numéros de documents d'immigration."],
      ["Où sont les données.", "Nos serveurs et notre base de données sont au Canada (Toronto)."],
      ["Vos droits.", "En vertu de la loi canadienne (LPRPDE), vous pouvez demander ce que nous détenons à votre sujet et le faire corriger ou supprimer."],
    ],
  },
} as const;

export default async function PrivacyPage() {
  const { lang } = await getT();
  const c = CONTENT[lang];
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <dl className="space-y-4">
        {c.items.map(([h, p]) => (
          <div key={h}>
            <dt className="font-semibold">{h}</dt>
            <dd>{p}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
