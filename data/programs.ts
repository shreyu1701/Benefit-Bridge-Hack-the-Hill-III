import type { Criterion, Localized, ProgramRecord } from "@/lib/rules/types";

/**
 * SEED program records.
 *
 * Every record ships with status "needs_verification" and approved_by = null.
 * They become "active" only after the page-change worker has fetched the live
 * source page and a human reviewer has approved the rules in /admin.
 * See docs/SOURCE_VERIFICATION.md for how each rule was checked and which
 * ones could not be confirmed.
 *
 * Conventions:
 *  - Each criterion cites the official page it came from (`source_url`).
 *  - `source_quote` is wording surfaced from that official page during
 *    verification; reviewers must confirm it against the live page.
 *  - A rule that returns `null` is an explicit data gap: we tell the user to
 *    check the official page instead of guessing a threshold.
 */

const L = (en: string, fr: string): Localized => ({ en, fr });

const CITIZEN_PR_PROTECTED = ["citizen", "permanent_resident", "protected_person"];
const TEMP_PERMIT = ["temporary_worker", "temporary_student"];

// ---------- Shared criteria -------------------------------------------------

const ageAtLeast = (id: string, min: number, src: string, quote?: string): Criterion => ({
  id,
  met: L(`You are ${min} or older`, `Vous avez ${min} ans ou plus`),
  failed: L(`You must be at least ${min} years old`, `Vous devez avoir au moins ${min} ans`),
  check: L("Tell us your age", "Indiquez votre âge"),
  logic: { ">=": [{ var: "age" }, min] },
  source_url: src,
  source_quote: quote,
});

// ---------- Federal ---------------------------------------------------------

const CCB_WHO = "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/who-apply.html";
const CCB_HOW_MUCH = "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/canada-child-benefit/how-much.html";

const ccb: ProgramRecord = {
  id: "ca-ccb",
  name: L("Canada Child Benefit (CCB)", "Allocation canadienne pour enfants (ACE)"),
  level: "federal",
  jurisdiction: "CA",
  source_url: CCB_WHO,
  application_url: CCB_WHO,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "child_under_18",
        met: L("You have a child under 18", "Vous avez un enfant de moins de 18 ans"),
        failed: L("The CCB is for families with children under 18", "L'ACE s'adresse aux familles ayant des enfants de moins de 18 ans"),
        check: L("Tell us if you have children and their ages", "Dites-nous si vous avez des enfants et leur âge"),
        logic: { "==": [{ var: "has_child_under_18" }, true] },
        source_url: CCB_HOW_MUCH,
        source_quote: "The CCB helps eligible families needing financial support with the costs of raising their children under 18 years of age.",
      },
      {
        id: "residency_status",
        met: L("Your immigration status qualifies", "Votre statut d'immigration est admissible"),
        failed: L(
          "You (or your partner) must be a citizen, permanent resident, protected person, or a temporary resident who has lived in Canada for 18 months",
          "Vous (ou votre partenaire) devez être citoyen, résident permanent, personne protégée ou résident temporaire au Canada depuis 18 mois",
        ),
        check: L(
          "Check the status rules on the CCB page — your status may qualify if you or your partner meet them",
          "Vérifiez les règles de statut sur la page de l'ACE",
        ),
        // visitor / other → null: we have no verified rule, so we say "check".
        logic: {
          if: [
            { in: [{ var: "residency_status" }, CITIZEN_PR_PROTECTED] }, true,
            { in: [{ var: "residency_status" }, TEMP_PERMIT] }, true,
            { "==": [{ var: "residency_status" }, "refugee_claimant"] }, false,
            null,
          ],
        },
        source_url: CCB_WHO,
        source_quote:
          "You or your spouse or common-law partner must be … a protected person … or a temporary resident … who has lived in Canada throughout the previous 18 months, and has a valid permit in the 19th month",
      },
      {
        id: "temporary_resident_18_months",
        met: L("You have lived in Canada at least 18 months", "Vous vivez au Canada depuis au moins 18 mois"),
        failed: L(
          "Temporary residents must have lived in Canada for the previous 18 months",
          "Les résidents temporaires doivent vivre au Canada depuis les 18 derniers mois",
        ),
        check: L("Tell us how long you have lived in Canada", "Indiquez depuis combien de temps vous vivez au Canada"),
        applies_if: { in: [{ var: "residency_status" }, TEMP_PERMIT] },
        logic: { ">=": [{ var: "years_in_canada" }, 1.5] },
        source_url: CCB_WHO,
        source_quote: "a temporary resident … who has lived in Canada throughout the previous 18 months, and has a valid permit in the 19th month",
      },
    ],
    also_required: [
      L("You must be the person mainly responsible for the child's care", "Vous devez être la personne principalement responsable des soins de l'enfant"),
      L("You (and your partner) must file a tax return every year", "Vous (et votre partenaire) devez produire une déclaration de revenus chaque année"),
      L("The child must live with you", "L'enfant doit vivre avec vous"),
    ],
  },
  benefit_amount: {
    text: L(
      "Up to $8,157 per year for each child under 6 (July 2026 – June 2027). You get the full amount if your adjusted family net income is under $38,237; it goes down gradually above that.",
      "Jusqu'à 8 157 $ par année pour chaque enfant de moins de 6 ans (juillet 2026 à juin 2027). Montant complet si le revenu familial net rajusté est inférieur à 38 237 $.",
    ),
    max_annual_cad: 8157,
    period: "July 2026 – June 2027",
    source_url: CCB_HOW_MUCH,
  },
  deadlines: [
    {
      label: L("Apply as soon as your child is born or starts living with you", "Faites une demande dès la naissance de l'enfant ou dès qu'il vit avec vous"),
      date: null,
      source_url: CCB_WHO,
    },
  ],
  how_to_apply: L(
    "Apply through CRA My Account, when you register your baby's birth in most provinces, or by mail with form RC66.",
    "Faites une demande dans Mon dossier de l'ARC, lors de l'enregistrement de la naissance, ou par la poste avec le formulaire RC66.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "The Canada Child Benefit is a tax-free monthly payment to help families pay for raising children under 18. The less your family earns, the more you get.",
    fr: "L'Allocation canadienne pour enfants est un paiement mensuel non imposable pour aider les familles à élever leurs enfants de moins de 18 ans. Plus le revenu familial est bas, plus le montant est élevé.",
  },
};

const CGEB_WHO = "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/gst-hst-credit/who-eligible.html";
const CGEB_HOW_MUCH = "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/gst-hst-credit/how-much.html";

const cgeb: ProgramRecord = {
  id: "ca-cgeb",
  // Renamed from "GST/HST credit" in July 2026 (see docs/SOURCE_VERIFICATION.md).
  name: L(
    "Canada Groceries and Essentials Benefit (formerly the GST/HST credit)",
    "Prestation canadienne pour l'épicerie et les produits essentiels (anciennement le crédit pour la TPS/TVH)",
  ),
  level: "federal",
  jurisdiction: "CA",
  source_url: CGEB_WHO,
  application_url: CGEB_WHO,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "age_19_or_partner_or_parent",
        met: L("You are 19 or older, or you have a partner or child", "Vous avez 19 ans ou plus, ou un partenaire ou un enfant"),
        failed: L(
          "You must be 19 or older (or have a partner, or be a parent living with your child)",
          "Vous devez avoir 19 ans ou plus (ou avoir un partenaire, ou être parent vivant avec votre enfant)",
        ),
        check: L("Tell us your age and household", "Indiquez votre âge et votre ménage"),
        logic: {
          or: [
            { ">=": [{ var: "age" }, 19] },
            { "==": [{ var: "has_partner" }, true] },
            { ">": [{ var: "num_children" }, 0] },
          ],
        },
        source_url: CGEB_WHO,
        source_quote: "In the month before the CRA makes a quarterly payment, you must be at least 19 years old.",
      },
      {
        id: "income_limit",
        met: L("Your income is under the limit", "Votre revenu est sous la limite"),
        failed: L("Your income is above the limit", "Votre revenu dépasse la limite"),
        check: L(
          "The income limit depends on your family size — check the amounts on the official page",
          "La limite de revenu dépend de la taille de la famille — vérifiez sur la page officielle",
        ),
        // DATA GAP: income cut-offs by family size were not verified from the official page.
        logic: { if: [false, true, null] },
        source_url: CGEB_HOW_MUCH,
      },
    ],
    also_required: [
      L("You must be a resident of Canada for tax purposes", "Vous devez être résident du Canada aux fins de l'impôt"),
      L("You must file a tax return every year, even with no income", "Vous devez produire une déclaration de revenus chaque année, même sans revenu"),
    ],
  },
  benefit_amount: {
    text: L(
      "The amount is calculated from your tax return. Payments from July 2026 to June 2027 are based on your 2025 return.",
      "Le montant est calculé à partir de votre déclaration de revenus. Les paiements de juillet 2026 à juin 2027 sont basés sur la déclaration de 2025.",
    ),
    max_annual_cad: null,
    period: "July 2026 – June 2027",
    source_url: CGEB_HOW_MUCH,
  },
  deadlines: [
    {
      label: L("File your 2025 tax return to get payments from July 2026", "Produisez votre déclaration 2025 pour recevoir les paiements à partir de juillet 2026"),
      date: null,
      source_url: CGEB_HOW_MUCH,
    },
  ],
  how_to_apply: L(
    "You don't apply separately. File your tax return every year and the CRA checks automatically.",
    "Aucune demande distincte. Produisez votre déclaration de revenus chaque année et l'ARC vérifie automatiquement.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "A tax-free payment every three months to help people with low and modest incomes pay for groceries and other essentials. It used to be called the GST/HST credit.",
    fr: "Un paiement non imposable tous les trois mois pour aider les personnes à revenu faible ou modeste à payer l'épicerie et les produits essentiels. Il s'appelait auparavant le crédit pour la TPS/TVH.",
  },
};

const CDCP_QUALIFY = "https://www.canada.ca/en/services/benefits/dental/dental-care-plan/qualify.html";
const CDCP_APPLY = "https://www.canada.ca/en/services/benefits/dental/dental-care-plan/apply.html";

const cdcp: ProgramRecord = {
  id: "ca-cdcp",
  name: L("Canadian Dental Care Plan (CDCP)", "Régime canadien de soins dentaires (RCSD)"),
  level: "federal",
  jurisdiction: "CA",
  source_url: CDCP_QUALIFY,
  application_url: CDCP_APPLY,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "no_dental_insurance",
        met: L("You don't have dental insurance", "Vous n'avez pas d'assurance dentaire"),
        failed: L("You can't have access to private dental insurance", "Vous ne devez pas avoir accès à une assurance dentaire privée"),
        check: L("Tell us if you have dental insurance through work, school or a private plan", "Dites-nous si vous avez une assurance dentaire"),
        logic: { "==": [{ var: "has_dental_insurance" }, false] },
        source_url: CDCP_QUALIFY,
        source_quote: "you cannot have access to private dental insurance or coverage",
      },
      {
        id: "income_under_90k",
        met: L("Your family income is under $90,000", "Votre revenu familial est inférieur à 90 000 $"),
        failed: L("Adjusted family net income must be less than $90,000", "Le revenu familial net rajusté doit être inférieur à 90 000 $"),
        check: L("Check whether your adjusted family net income is under $90,000", "Vérifiez si votre revenu familial net rajusté est inférieur à 90 000 $"),
        logic: { "<": [{ var: "family_income" }, 90000] },
        source_url: CDCP_QUALIFY,
        source_quote: "your adjusted family net income must be less than $90,000",
      },
    ],
    also_required: [
      L("You must be a resident of Canada for tax purposes", "Vous devez être résident du Canada aux fins de l'impôt"),
      L("You (and your partner) must have filed a tax return last year", "Vous (et votre partenaire) devez avoir produit une déclaration de revenus l'an dernier"),
    ],
  },
  benefit_amount: {
    text: L(
      "Covers part of the cost of many dental services. No co-payment if family income is under $70,000; 40% co-payment for $70,000–$79,999; 60% for $80,000–$89,999.",
      "Couvre une partie du coût de nombreux soins dentaires. Aucune quote-part si le revenu familial est inférieur à 70 000 $; 40 % entre 70 000 $ et 79 999 $; 60 % entre 80 000 $ et 89 999 $.",
    ),
    max_annual_cad: null,
    source_url: CDCP_QUALIFY,
  },
  deadlines: [],
  how_to_apply: L("Apply online, by phone, or with a paper form.", "Faites une demande en ligne, par téléphone ou avec un formulaire papier."),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "The Canadian Dental Care Plan helps pay for dental care for people who don't have dental insurance and have a family income under $90,000.",
    fr: "Le Régime canadien de soins dentaires aide à payer les soins dentaires des personnes sans assurance dentaire dont le revenu familial est inférieur à 90 000 $.",
  },
};

const CWB_BASE =
  "https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-45300-canada-workers-benefit-cwb";
const CWB_WHO = `${CWB_BASE}/who-is-eligible.html`;
const CWB_HOW_MUCH = `${CWB_BASE}/how-much-you-can-get.html`;

const cwb: ProgramRecord = {
  id: "ca-cwb",
  name: L("Canada Workers Benefit (CWB)", "Allocation canadienne pour les travailleurs (ACT)"),
  level: "federal",
  jurisdiction: "CA",
  source_url: CWB_WHO,
  application_url: `${CWB_BASE}/how-to-claim.html`,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "has_working_income",
        met: L("You earn income from work", "Vous avez un revenu de travail"),
        failed: L("The CWB is only for people who earn income from work", "L'ACT est réservée aux personnes qui ont un revenu de travail"),
        check: L("Tell us if you work", "Dites-nous si vous travaillez"),
        logic: { "==": [{ var: "has_working_income" }, true] },
        source_url: CWB_WHO,
        source_quote: "To be eligible, you must earn working income",
      },
      {
        id: "age_19_or_partner_or_child",
        met: L("You are 19 or older, or live with a partner or child", "Vous avez 19 ans ou plus, ou vivez avec un partenaire ou un enfant"),
        failed: L("You must be 19 or older, or live with a partner or child", "Vous devez avoir 19 ans ou plus, ou vivre avec un partenaire ou un enfant"),
        check: L("Tell us your age and household", "Indiquez votre âge et votre ménage"),
        logic: {
          or: [
            { ">=": [{ var: "age" }, 19] },
            { "==": [{ var: "has_partner" }, true] },
            { ">": [{ var: "num_children" }, 0] },
          ],
        },
        source_url: CWB_WHO,
      },
      {
        id: "not_full_time_student",
        met: L("You are not a full-time student (or you have a child)", "Vous n'êtes pas étudiant à temps plein (ou vous avez un enfant)"),
        failed: L(
          "Full-time students (more than 13 weeks in the year) can't get the CWB unless they have an eligible dependant",
          "Les étudiants à temps plein (plus de 13 semaines dans l'année) ne peuvent pas recevoir l'ACT sauf s'ils ont une personne à charge admissible",
        ),
        check: L("Tell us if you are a full-time student", "Dites-nous si vous êtes étudiant à temps plein"),
        applies_if: { "==": [{ var: "is_full_time_student" }, true] },
        logic: { ">": [{ var: "num_children" }, 0] },
        source_url: CWB_WHO,
      },
      {
        id: "income_limit",
        met: L("Your income is under the CWB limit", "Votre revenu est sous la limite de l'ACT"),
        failed: L(
          "Your income is above the CWB limit ($37,742 single / $49,393 family, 2025 tax year)",
          "Votre revenu dépasse la limite de l'ACT (37 742 $ seul / 49 393 $ famille, année 2025)",
        ),
        check: L(
          "Check the CWB income limits — they are higher if you have a disability",
          "Vérifiez les limites de revenu de l'ACT — elles sont plus élevées en cas d'invalidité",
        ),
        // With a disability the supplement has different limits we have not verified → null (data gap).
        logic: {
          if: [
            { "==": [{ var: "disability" }, true] }, null,
            { or: [{ "==": [{ var: "has_partner" }, true] }, { ">": [{ var: "num_children" }, 0] }] },
            { "<=": [{ var: "family_income" }, 49393] },
            { "<=": [{ var: "family_income" }, 37742] },
          ],
        },
        source_url: CWB_HOW_MUCH,
        source_quote:
          "no basic amount is paid if adjusted net income is more than $37,742 [single] … no basic amount is paid if adjusted family net income is more than $49,393 [families]",
      },
    ],
    also_required: [
      L("You must live in Canada for the whole year", "Vous devez vivre au Canada toute l'année"),
      L("You claim it on your tax return", "Vous la demandez dans votre déclaration de revenus"),
    ],
  },
  benefit_amount: {
    text: L(
      "Reduced gradually above $26,855 (single) or $30,639 (family) of adjusted net income, 2025 tax year. There is also a disability supplement.",
      "Réduite graduellement au-delà de 26 855 $ (seul) ou 30 639 $ (famille) de revenu net rajusté, année 2025. Il existe aussi un supplément pour invalidité.",
    ),
    max_annual_cad: null,
    period: "2025 tax year",
    source_url: CWB_HOW_MUCH,
  },
  deadlines: [
    { label: L("Claim it when you file your tax return", "Demandez-la en produisant votre déclaration"), date: null, source_url: `${CWB_BASE}/how-to-claim.html` },
  ],
  how_to_apply: L(
    "Claim it on your tax return (Schedule 6). You may get part of it in advance payments.",
    "Demandez-la dans votre déclaration de revenus (annexe 6). Vous pouvez en recevoir une partie par versements anticipés.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "The Canada Workers Benefit is money back on your taxes for people who work and earn a low income.",
    fr: "L'Allocation canadienne pour les travailleurs est un crédit d'impôt remboursable pour les personnes qui travaillent et gagnent un faible revenu.",
  },
};

const OAS_ELIG = "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/eligibility.html";
const OAS_PAY = "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/payments.html";

const oasResidence: Criterion = {
  id: "ten_years_since_18",
  met: L("You have lived in Canada at least 10 years since age 18", "Vous vivez au Canada depuis au moins 10 ans après 18 ans"),
  failed: L("You need to have lived in Canada at least 10 years after turning 18", "Vous devez avoir vécu au Canada au moins 10 ans après l'âge de 18 ans"),
  check: L("Tell us how many years you have lived in Canada", "Indiquez depuis combien d'années vous vivez au Canada"),
  logic: { ">=": [{ var: "years_in_canada_since_18" }, 10] },
  source_url: OAS_ELIG,
  source_quote: "Have lived in Canada for at least 10 years since the age of 18",
};

const oasStatus: Criterion = {
  id: "legal_status",
  met: L("You are a citizen or permanent resident", "Vous êtes citoyen ou résident permanent"),
  failed: L("You must be a Canadian citizen or legal resident", "Vous devez être citoyen canadien ou résident légal"),
  check: L("Check whether your status counts as a legal resident on the OAS page", "Vérifiez si votre statut compte comme résident légal"),
  logic: {
    if: [
      { in: [{ var: "residency_status" }, ["citizen", "permanent_resident"]] }, true,
      { in: [{ var: "residency_status" }, ["visitor"]] }, false,
      null,
    ],
  },
  source_url: OAS_ELIG,
};

const oas: ProgramRecord = {
  id: "ca-oas",
  name: L("Old Age Security (OAS) pension", "Pension de la Sécurité de la vieillesse (SV)"),
  level: "federal",
  jurisdiction: "CA",
  source_url: OAS_ELIG,
  application_url: OAS_ELIG,
  eligibility_rules: {
    version: 1,
    criteria: [ageAtLeast("age_65", 65, OAS_ELIG), oasStatus, oasResidence],
    also_required: [
      L("Many people are enrolled automatically; you'll get a letter the month after you turn 64", "Beaucoup de personnes sont inscrites automatiquement"),
    ],
  },
  benefit_amount: {
    text: L(
      "Monthly amount depends on how long you have lived in Canada and your age. See the payment amounts page for the current quarter.",
      "Le montant mensuel dépend du nombre d'années au Canada et de votre âge. Consultez la page des montants pour le trimestre en cours.",
    ),
    max_annual_cad: null,
    source_url: OAS_PAY,
  },
  deadlines: [],
  how_to_apply: L(
    "You may be enrolled automatically. If not, apply online through My Service Canada Account or by mail.",
    "Vous pourriez être inscrit automatiquement. Sinon, faites une demande en ligne ou par la poste.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "Old Age Security is a monthly payment for people 65 and older who have lived in Canada for at least 10 years as adults.",
    fr: "La Sécurité de la vieillesse est un paiement mensuel pour les personnes de 65 ans et plus ayant vécu au Canada au moins 10 ans à l'âge adulte.",
  },
};

const GIS_ELIG = "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/eligibility.html";
const GIS_AMT = "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/benefit-amount.html";

const gis: ProgramRecord = {
  id: "ca-gis",
  name: L("Guaranteed Income Supplement (GIS)", "Supplément de revenu garanti (SRG)"),
  level: "federal",
  jurisdiction: "CA",
  source_url: GIS_ELIG,
  application_url: "https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/apply.html",
  eligibility_rules: {
    version: 1,
    criteria: [
      ageAtLeast("age_65", 65, GIS_ELIG),
      { ...oasStatus, source_url: GIS_ELIG },
      { ...oasResidence, source_url: GIS_ELIG },
      {
        id: "income_limit",
        met: L("Your income is under the GIS limit", "Votre revenu est sous la limite du SRG"),
        failed: L("Your income is above the GIS limit", "Votre revenu dépasse la limite du SRG"),
        check: L(
          "The GIS income limit depends on your marital status and changes every 3 months — check the official table",
          "La limite de revenu du SRG dépend de votre situation et change tous les 3 mois — consultez le tableau officiel",
        ),
        // DATA GAP: quarterly thresholds are published in the OAS benefit tables; not yet ingested.
        logic: { if: [false, true, null] },
        source_url: GIS_AMT,
      },
    ],
    also_required: [L("You must be receiving (or qualify for) the OAS pension", "Vous devez recevoir la pension de la SV (ou y être admissible)")],
  },
  benefit_amount: {
    text: L(
      "Up to $1,123.17 per month if you are single, widowed or divorced (October 2026). It goes down by $1 for every $2 of other income.",
      "Jusqu'à 1 123,17 $ par mois si vous êtes seul, veuf ou divorcé (octobre 2026). Réduit de 1 $ pour chaque 2 $ d'autres revenus.",
    ),
    max_annual_cad: null,
    period: "October – December 2026",
    source_url: GIS_AMT,
  },
  deadlines: [],
  how_to_apply: L("You may be enrolled automatically with OAS. If not, apply online or by mail.", "Vous pourriez être inscrit automatiquement avec la SV. Sinon, faites une demande."),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "The Guaranteed Income Supplement is an extra monthly payment for people who get Old Age Security and have a low income.",
    fr: "Le Supplément de revenu garanti est un paiement mensuel supplémentaire pour les personnes qui reçoivent la SV et ont un faible revenu.",
  },
};

// ---------- Ontario ---------------------------------------------------------

const OTB = "https://www.ontario.ca/page/ontario-trillium-benefit";

const otb: ProgramRecord = {
  id: "on-otb",
  name: L("Ontario Trillium Benefit (OTB)", "Prestation Trillium de l'Ontario (PTO)"),
  level: "provincial",
  jurisdiction: "ON",
  source_url: OTB,
  application_url: OTB,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "age_18_or_partner_or_parent",
        met: L("You are 18 or older, or have a partner or child", "Vous avez 18 ans ou plus, ou un partenaire ou un enfant"),
        failed: L("You must be 18 or older, or have a partner or child", "Vous devez avoir 18 ans ou plus, ou un partenaire ou un enfant"),
        check: L("Tell us your age", "Indiquez votre âge"),
        logic: {
          or: [
            { ">=": [{ var: "age" }, 18] },
            { "==": [{ var: "has_partner" }, true] },
            { ">": [{ var: "num_children" }, 0] },
          ],
        },
        source_url: OTB,
      },
      {
        id: "income_limit",
        met: L("Your income is under the limit", "Votre revenu est sous la limite"),
        failed: L("Your income is above the limit", "Votre revenu dépasse la limite"),
        check: L(
          "The OTB combines three credits, each with its own income limit — check the official page",
          "La PTO combine trois crédits, chacun avec sa propre limite de revenu — consultez la page officielle",
        ),
        // DATA GAP: limits for OEPTC / NOEC / OSTC differ by family type; not verified yet.
        logic: { if: [false, true, null] },
        source_url: OTB,
      },
    ],
    also_required: [
      L("File your tax return every year", "Produisez votre déclaration de revenus chaque année"),
      L("For the energy and property tax part, fill out form ON-BEN with your return", "Pour la partie énergie et impôts fonciers, remplissez le formulaire ON-BEN"),
    ],
  },
  benefit_amount: {
    text: L(
      "Combines the Ontario energy and property tax credit, Northern Ontario energy credit and Ontario sales tax credit. 2026 payments are based on your 2025 return and are paid on the 10th of each month starting July 2026.",
      "Combine le crédit pour les coûts d'énergie et les impôts fonciers, le crédit pour les coûts d'énergie dans le Nord et le crédit de taxe de vente de l'Ontario. Versée le 10 de chaque mois à partir de juillet 2026.",
    ),
    max_annual_cad: null,
    period: "July 2026 – June 2027",
    source_url: OTB,
  },
  deadlines: [
    { label: L("File your 2025 tax return with form ON-BEN", "Produisez votre déclaration 2025 avec le formulaire ON-BEN"), date: null, source_url: OTB },
  ],
  how_to_apply: L(
    "File your tax return and fill out form ON-BEN. You don't need to apply for the sales tax credit part.",
    "Produisez votre déclaration et remplissez le formulaire ON-BEN. Aucune demande pour la partie taxe de vente.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "The Ontario Trillium Benefit is a tax-free payment that helps people with low to moderate incomes pay for energy costs and sales and property tax.",
    fr: "La Prestation Trillium de l'Ontario est un paiement non imposable qui aide les personnes à revenu faible ou modeste à payer l'énergie, la taxe de vente et l'impôt foncier.",
  },
};

const CHILDCARE = "https://www.ontario.ca/page/find-and-pay-child-care";
const CWELCC_AGREEMENT = "https://www.ontario.ca/page/canada-ontario-early-years-and-child-care-agreement";

const onChildCare: ProgramRecord = {
  id: "on-child-care-fee-reduction",
  name: L("Ontario child care fee reduction ($10-a-day child care)", "Réduction des frais de garde d'enfants de l'Ontario"),
  level: "provincial",
  jurisdiction: "ON",
  source_url: CWELCC_AGREEMENT,
  application_url: CHILDCARE,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "child_under_6",
        met: L("You have a child under 6", "Vous avez un enfant de moins de 6 ans"),
        failed: L("Fee reductions are for children under 6", "Les réductions visent les enfants de moins de 6 ans"),
        check: L("Tell us your children's ages", "Indiquez l'âge de vos enfants"),
        logic: { "==": [{ var: "has_child_under_6" }, true] },
        source_url: CWELCC_AGREEMENT,
        source_quote: "As a parent or guardian of a child under the age of 6, you do not need to apply to get a fee reduction.",
      },
    ],
    also_required: [
      L(
        "Your child must attend a licensed child care program that has joined the Canada-wide (CWELCC) system — ask your provider",
        "Votre enfant doit fréquenter un programme agréé participant au système pancanadien (APGE) — demandez à votre fournisseur",
      ),
    ],
  },
  benefit_amount: {
    text: L(
      "Fees in participating programs were capped at $22 per day on January 1, 2025, with a goal of an average of $10 a day. Ask your provider for your current fee.",
      "Les frais des programmes participants sont plafonnés à 22 $ par jour depuis le 1er janvier 2025, avec l'objectif d'une moyenne de 10 $ par jour.",
    ),
    max_annual_cad: null,
    source_url: CWELCC_AGREEMENT,
  },
  deadlines: [],
  how_to_apply: L(
    "No application needed — the reduction is automatic at participating licensed providers. Waitlists are common, so contact centres early.",
    "Aucune demande — la réduction est automatique chez les fournisseurs participants. Inscrivez-vous tôt sur les listes d'attente.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "If your child under 6 goes to a licensed child care program that is part of the Canada-wide system, your fees are reduced automatically.",
    fr: "Si votre enfant de moins de 6 ans fréquente un service de garde agréé participant au système pancanadien, vos frais sont réduits automatiquement.",
  },
};

const OSAP = "https://www.ontario.ca/page/osap-ontario-student-assistance-program";
const OSAP_DEF = "https://www.ontario.ca/page/osap-definitions";

const osap: ProgramRecord = {
  id: "on-osap",
  name: L("Ontario Student Assistance Program (OSAP)", "Régime d'aide financière aux étudiantes et étudiants de l'Ontario (RAFEO)"),
  level: "provincial",
  jurisdiction: "ON",
  source_url: OSAP,
  application_url: "https://www.ontario.ca/page/how-apply-osap",
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "post_secondary_student",
        met: L("You are (or plan to be) a college or university student", "Vous êtes (ou serez) étudiant au collège ou à l'université"),
        failed: L("OSAP is for college and university students", "Le RAFEO s'adresse aux étudiants du collège ou de l'université"),
        check: L("Tell us if you are a college or university student", "Dites-nous si vous étudiez au collège ou à l'université"),
        logic: { "==": [{ var: "is_post_secondary_student" }, true] },
        source_url: OSAP,
      },
      {
        id: "status",
        met: L("You are a citizen, permanent resident or protected person", "Vous êtes citoyen, résident permanent ou personne protégée"),
        failed: L(
          "OSAP is for Canadian citizens, permanent residents and protected persons",
          "Le RAFEO est réservé aux citoyens, résidents permanents et personnes protégées",
        ),
        check: L("Tell us your immigration status", "Indiquez votre statut d'immigration"),
        logic: { in: [{ var: "residency_status" }, CITIZEN_PR_PROTECTED] },
        source_url: OSAP_DEF,
      },
    ],
    also_required: [
      L("You must meet Ontario residency rules (see the OSAP page)", "Vous devez respecter les règles de résidence en Ontario"),
      L("Your program and school must be OSAP-approved", "Votre programme et votre établissement doivent être approuvés par le RAFEO"),
      L("How much you get depends on your family income and costs", "Le montant dépend du revenu familial et des coûts"),
    ],
  },
  benefit_amount: {
    text: L("Grants and loans based on your costs and family income.", "Bourses et prêts selon vos coûts et le revenu familial."),
    max_annual_cad: null,
    period: "2026–27 academic year",
    source_url: OSAP,
  },
  deadlines: [
    {
      label: L("2026–27 applies to study periods starting Aug 1, 2026 – Jul 31, 2027", "2026-2027 : périodes d'études commençant du 1er août 2026 au 31 juillet 2027"),
      date: null,
      source_url: OSAP_DEF,
    },
  ],
  how_to_apply: L("Apply online on the OSAP website.", "Faites une demande en ligne sur le site du RAFEO."),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "OSAP gives grants and loans to help pay for college or university. How much you get depends on your costs and your family's income.",
    fr: "Le RAFEO offre des bourses et des prêts pour payer le collège ou l'université. Le montant dépend de vos coûts et du revenu familial.",
  },
};

const OW_ELIG = "https://www.ontario.ca/page/eligibility-ontario-works-financial-assistance";
const OW_RES = "https://www.ontario.ca/document/ontario-works-policy-directives/31-residency-requirements";

const ow: ProgramRecord = {
  id: "on-ow",
  name: L("Ontario Works", "Ontario au travail"),
  level: "provincial",
  jurisdiction: "ON",
  source_url: OW_ELIG,
  application_url: "https://www.ontario.ca/page/ontario-works",
  eligibility_rules: {
    version: 1,
    criteria: [
      ageAtLeast("age_18", 18, OW_ELIG),
      {
        id: "status",
        met: L("Your status allows you to apply", "Votre statut vous permet de faire une demande"),
        failed: L("Your immigration status may not qualify", "Votre statut d'immigration pourrait ne pas être admissible"),
        check: L("Check the residency rules for your immigration status", "Vérifiez les règles de résidence pour votre statut"),
        logic: {
          if: [
            { in: [{ var: "residency_status" }, ["citizen", "permanent_resident", "protected_person", "refugee_claimant"]] }, true,
            null,
          ],
        },
        source_url: OW_RES,
      },
      {
        id: "financial_need",
        met: L("You are in financial need", "Vous êtes dans le besoin financier"),
        failed: L("You are not in financial need", "Vous n'êtes pas dans le besoin financier"),
        check: L(
          "Ontario Works looks at your income, assets, family size and housing costs — your caseworker decides if you're in financial need",
          "Ontario au travail examine vos revenus, vos biens, la taille de la famille et le logement",
        ),
        // DATA GAP: financial need is assessed case by case; no single published threshold.
        logic: { if: [false, true, null] },
        source_url: OW_ELIG,
        source_quote: "To be eligible for Ontario Works, you need to be in financial need and be willing to work towards finding employment.",
      },
    ],
    also_required: [
      L("You must be willing to take part in employment activities", "Vous devez être prêt à participer à des activités d'emploi"),
    ],
  },
  benefit_amount: {
    text: L(
      "Money for food and housing costs, plus health benefits. The amount depends on your family size and costs.",
      "De l'argent pour la nourriture et le logement, plus des prestations de santé. Le montant dépend de la taille de la famille.",
    ),
    max_annual_cad: null,
    source_url: OW_ELIG,
  },
  deadlines: [],
  how_to_apply: L(
    "Apply online (20–30 minutes), by phone, or in person at a local office.",
    "Faites une demande en ligne (20 à 30 minutes), par téléphone ou en personne.",
  ),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "Ontario Works gives money for food and housing, and help finding a job, to people in Ontario who are in financial need.",
    fr: "Ontario au travail offre de l'argent pour la nourriture et le logement, et de l'aide à l'emploi, aux personnes dans le besoin financier en Ontario.",
  },
};

// ---------- City of Toronto -------------------------------------------------

const FAIR_PASS =
  "https://www.toronto.ca/community-people/employment-social-support/support-for-people-in-financial-need/assistance-through-ontario-works/transit-discount/";
const FAIR_PASS_APPLY = `${FAIR_PASS}apply-for-the-fair-pass-transit-discount-program/`;

const fairPass: ProgramRecord = {
  id: "to-fair-pass",
  name: L("Fair Pass Transit Discount Program", "Programme de réduction des tarifs de transport Fair Pass"),
  level: "municipal",
  jurisdiction: "ON-TORONTO",
  source_url: FAIR_PASS,
  application_url: FAIR_PASS_APPLY,
  eligibility_rules: {
    version: 1,
    criteria: [
      {
        id: "age_20_to_64",
        met: L("You are between 20 and 64", "Vous avez entre 20 et 64 ans"),
        failed: L("Fair Pass is for adults aged 20 to 64", "Fair Pass s'adresse aux adultes de 20 à 64 ans"),
        check: L("Tell us your age", "Indiquez votre âge"),
        logic: { and: [{ ">=": [{ var: "age" }, 20] }, { "<=": [{ var: "age" }, 64] }] },
        source_url: FAIR_PASS,
      },
      {
        id: "income_below_75pct_lim_at",
        met: L("Your household income is below the Fair Pass limit", "Le revenu de votre ménage est sous la limite Fair Pass"),
        failed: L(
          "Household income must be below 75% of the Low-Income Measure (e.g. $20,514 for one person, $41,028 for four)",
          "Le revenu du ménage doit être inférieur à 75 % de la mesure de faible revenu (ex. 20 514 $ pour une personne, 41 028 $ pour quatre)",
        ),
        check: L(
          "Check the income table for your household size on the Fair Pass page",
          "Consultez le tableau des revenus selon la taille du ménage sur la page Fair Pass",
        ),
        // Only household sizes whose limits we verified are encoded; others → null (data gap).
        logic: {
          if: [
            { "==": [{ var: "household_size" }, 1] }, { "<": [{ var: "family_income" }, 20514] },
            { "==": [{ var: "household_size" }, 4] }, { "<": [{ var: "family_income" }, 41028] },
            null,
          ],
        },
        source_url: FAIR_PASS,
        source_quote:
          "a single individual with an after-tax income below $20,514 or a family of four with an income below $41,028 would be eligible",
      },
    ],
    also_required: [
      L("You need a PRESTO card", "Vous avez besoin d'une carte PRESTO"),
      L("People getting Ontario Works or ODSP may qualify through their caseworker", "Les bénéficiaires d'Ontario au travail ou du POSPH peuvent être admissibles par leur agent"),
    ],
  },
  benefit_amount: {
    text: L(
      "Pay $2.10 instead of $3.30 for an adult TTC single fare (save $1.20 per ride) for 12 months.",
      "Payez 2,10 $ au lieu de 3,30 $ pour un passage simple adulte de la TTC (économie de 1,20 $) pendant 12 mois.",
    ),
    max_annual_cad: null,
    source_url: FAIR_PASS,
  },
  deadlines: [
    {
      label: L("From August 1, 2026, eligibility is reviewed every year", "À partir du 1er août 2026, l'admissibilité est révisée chaque année"),
      date: "2026-08-01",
      source_url: FAIR_PASS,
    },
  ],
  how_to_apply: L("Apply online with your PRESTO card number.", "Faites une demande en ligne avec votre numéro de carte PRESTO."),
  status: "needs_verification",
  last_verified_at: null,
  approved_by: null,
  summaries_by_language: {
    en: "Fair Pass lowers the cost of TTC rides for Toronto adults with low income.",
    fr: "Fair Pass réduit le coût des trajets de la TTC pour les adultes à faible revenu de Toronto.",
  },
};

export const SEED_PROGRAMS: ProgramRecord[] = [ccb, cgeb, cdcp, cwb, oas, gis, otb, onChildCare, osap, ow, fairPass];
