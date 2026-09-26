import type { Localized } from "@/lib/rules/types";

/**
 * Tier 3 reference data: the laws behind each program.
 * `what_changed` is a DRAFT until a reviewer approves it (`approved: false`);
 * the UI shows unapproved text with a "draft — not yet reviewed" label.
 * Consolidated text is refreshed by worker/jobs/reference-laws.ts from the
 * Justice Laws XML (federal) and e-Laws (Ontario).
 */
export interface LawRecord {
  id: string;
  jurisdiction: string;
  kind: "act" | "regulation" | "council_decision";
  citation: string;
  title: Localized;
  source_url: string;
  /** Machine-readable consolidated text, where the publisher provides it. */
  xml_url: string | null;
  what_changed: Localized;
  approved: boolean;
}

export const SEED_LAWS: LawRecord[] = [
  {
    id: "ca-income-tax-act",
    jurisdiction: "CA",
    kind: "act",
    citation: "R.S.C. 1985, c. 1 (5th Supp.)",
    title: { en: "Income Tax Act", fr: "Loi de l'impôt sur le revenu" },
    source_url: "https://laws-lois.justice.gc.ca/eng/acts/I-3.3/",
    xml_url: "https://laws-lois.justice.gc.ca/eng/XML/I-3.3.xml",
    what_changed: {
      en: "The Income Tax Act sets the rules for the Canada Child Benefit, the Canada Workers Benefit and the GST/HST credit (now the Canada Groceries and Essentials Benefit). Because these are paid through the tax system, you usually get them by filing a tax return.",
      fr: "La Loi de l'impôt sur le revenu établit les règles de l'Allocation canadienne pour enfants, de l'Allocation canadienne pour les travailleurs et du crédit pour la TPS/TVH. Comme elles passent par l'impôt, il faut généralement produire une déclaration.",
    },
    approved: false,
  },
  {
    id: "ca-old-age-security-act",
    jurisdiction: "CA",
    kind: "act",
    citation: "R.S.C. 1985, c. O-9",
    title: { en: "Old Age Security Act", fr: "Loi sur la sécurité de la vieillesse" },
    source_url: "https://laws-lois.justice.gc.ca/eng/acts/O-9/",
    xml_url: "https://laws-lois.justice.gc.ca/eng/XML/O-9.xml",
    what_changed: {
      en: "This law creates the Old Age Security pension and the Guaranteed Income Supplement, and sets who qualifies: age, years lived in Canada and, for the GIS, income.",
      fr: "Cette loi crée la pension de la Sécurité de la vieillesse et le Supplément de revenu garanti et fixe les conditions : âge, années au Canada et, pour le SRG, revenu.",
    },
    approved: false,
  },
  {
    id: "ca-early-learning-child-care-act",
    jurisdiction: "CA",
    kind: "act",
    citation: "S.C. 2024, c. 2",
    title: { en: "Canada Early Learning and Child Care Act", fr: "Loi relative à l'apprentissage et à la garde des jeunes enfants au Canada" },
    source_url: "https://laws-lois.justice.gc.ca/eng/acts/C-3.55/",
    xml_url: "https://laws-lois.justice.gc.ca/eng/XML/C-3.55.xml",
    what_changed: {
      en: "This law commits the federal government to long-term funding for affordable child care with the provinces, including the agreement that lowers fees in Ontario.",
      fr: "Cette loi engage le gouvernement fédéral à financer à long terme des services de garde abordables avec les provinces, y compris l'entente qui réduit les frais en Ontario.",
    },
    approved: false,
  },
  {
    id: "on-taxation-act-2007",
    jurisdiction: "ON",
    kind: "act",
    citation: "S.O. 2007, c. 11, Sched. A",
    title: { en: "Taxation Act, 2007", fr: "Loi de 2007 sur les impôts" },
    source_url: "https://www.ontario.ca/laws/statute/07t11",
    xml_url: null,
    what_changed: {
      en: "Ontario's Taxation Act sets the rules for the Ontario energy and property tax credit, the Northern Ontario energy credit and the Ontario sales tax credit, which are paid together as the Ontario Trillium Benefit.",
      fr: "La Loi de 2007 sur les impôts de l'Ontario établit les crédits versés ensemble sous forme de Prestation Trillium de l'Ontario.",
    },
    approved: false,
  },
  {
    id: "on-child-care-early-years-act",
    jurisdiction: "ON",
    kind: "act",
    citation: "S.O. 2014, c. 11, Sched. 1",
    title: { en: "Child Care and Early Years Act, 2014", fr: "Loi de 2014 sur la garde d'enfants et la petite enfance" },
    source_url: "https://www.ontario.ca/laws/statute/14c11",
    xml_url: null,
    what_changed: {
      en: "This law sets the rules for licensed child care in Ontario, including how fee reductions under the Canada-wide system are applied.",
      fr: "Cette loi encadre les services de garde agréés en Ontario, y compris l'application des réductions de frais du système pancanadien.",
    },
    approved: false,
  },
  {
    id: "on-ontario-works-act",
    jurisdiction: "ON",
    kind: "act",
    citation: "S.O. 1997, c. 25, Sched. A",
    title: { en: "Ontario Works Act, 1997", fr: "Loi de 1997 sur le programme Ontario au travail" },
    source_url: "https://www.ontario.ca/laws/statute/97o25a",
    xml_url: null,
    what_changed: {
      en: "This law creates Ontario Works: financial help and employment support for people in financial need.",
      fr: "Cette loi crée Ontario au travail : aide financière et soutien à l'emploi pour les personnes dans le besoin.",
    },
    approved: false,
  },
  {
    id: "on-mtcu-act",
    jurisdiction: "ON",
    kind: "act",
    citation: "R.S.O. 1990, c. M.19",
    title: { en: "Ministry of Training, Colleges and Universities Act", fr: "Loi sur le ministère de la Formation et des Collèges et Universités" },
    source_url: "https://www.ontario.ca/laws/statute/90m19",
    xml_url: null,
    what_changed: {
      en: "This law allows Ontario to give student grants and loans. OSAP's detailed rules are set in regulations under it.",
      fr: "Cette loi permet à l'Ontario d'accorder des bourses et des prêts étudiants. Les règles détaillées du RAFEO figurent dans ses règlements.",
    },
    approved: false,
  },
  {
    id: "to-fair-pass-council-2016",
    jurisdiction: "ON-TORONTO",
    kind: "council_decision",
    citation: "Toronto City Council, Executive Committee report EX (2016)",
    title: { en: "Fair Pass: Transit Fare Equity Program for Low-Income Torontonians", fr: "Fair Pass : programme d'équité tarifaire (rapport au conseil, 2016)" },
    source_url: "https://www.toronto.ca/legdocs/mmis/2016/ex/bgrd/backgroundfile-98467.pdf",
    xml_url: null,
    what_changed: {
      en: "City Council approved a transit fare discount for Toronto residents with low income, rolled out in phases. Later decisions expanded who can get it.",
      fr: "Le conseil municipal a approuvé une réduction des tarifs pour les résidents à faible revenu, déployée par étapes et élargie par la suite.",
    },
    approved: false,
  },
];

export interface ProgramLawLink {
  program_id: string;
  law_id: string;
  relationship: "created" | "amended" | "funded" | "governs";
}

/** Links whose law could not be identified from an official source are omitted (see docs). */
export const SEED_PROGRAM_LAW_LINKS: ProgramLawLink[] = [
  { program_id: "ca-ccb", law_id: "ca-income-tax-act", relationship: "governs" },
  { program_id: "ca-cgeb", law_id: "ca-income-tax-act", relationship: "governs" },
  { program_id: "ca-cwb", law_id: "ca-income-tax-act", relationship: "governs" },
  { program_id: "ca-oas", law_id: "ca-old-age-security-act", relationship: "created" },
  { program_id: "ca-gis", law_id: "ca-old-age-security-act", relationship: "created" },
  { program_id: "on-otb", law_id: "on-taxation-act-2007", relationship: "governs" },
  { program_id: "on-child-care-fee-reduction", law_id: "ca-early-learning-child-care-act", relationship: "funded" },
  { program_id: "on-child-care-fee-reduction", law_id: "on-child-care-early-years-act", relationship: "governs" },
  { program_id: "on-osap", law_id: "on-mtcu-act", relationship: "governs" },
  { program_id: "on-ow", law_id: "on-ontario-works-act", relationship: "created" },
  { program_id: "to-fair-pass", law_id: "to-fair-pass-council-2016", relationship: "created" },
];
