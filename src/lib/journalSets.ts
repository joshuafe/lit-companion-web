// Keep in sync with ranking/journal_sets.py — names here are the canonical
// journal strings stored into profiles.suggested_journals.

export interface JournalSet {
  id: string;
  name: string;
  description: string;
  journals: string[];
}

export const JOURNAL_SETS: JournalSet[] = [
  {
    id: "general_high_impact",
    name: "General high-impact",
    description: "Broad flagships that cover everything.",
    journals: [
      "Nature",
      "Science",
      "Cell",
      "N Engl J Med",
      "Lancet",
      "JAMA",
      "BMJ",
      "PNAS",
    ],
  },
  {
    id: "clinical_heme_onc",
    name: "Clinical heme / onc",
    description: "Practice-changing trials and translational results.",
    journals: [
      "N Engl J Med",
      "Lancet",
      "Lancet Oncol",
      "JAMA",
      "JAMA Oncol",
      "Blood",
      "Blood Adv",
      "J Clin Oncol",
      "Nat Med",
      "Nat Cancer",
      "Cancer Cell",
      "Cell Rep Med",
      "Sci Transl Med",
      "J Clin Invest",
    ],
  },
  {
    id: "basic_immunology",
    name: "Basic immunology",
    description: "Mechanism-focused immunology flagships.",
    journals: [
      "Immunity",
      "Nat Immunol",
      "Sci Immunol",
      "J Exp Med",
      "Nat Rev Immunol",
      "Cell",
      "Nature",
      "Science",
      "eLife",
      "Cell Rep",
    ],
  },
  {
    id: "cancer_biology",
    name: "Cancer biology",
    description: "Tumor biology, microenvironment, mechanism.",
    journals: [
      "Cancer Cell",
      "Nat Cancer",
      "Nat Rev Cancer",
      "Cell",
      "Nature",
      "Science",
      "Mol Cell",
      "Cell Rep",
      "Nat Med",
      "J Clin Invest",
    ],
  },
  {
    id: "translational_med",
    name: "Translational medicine",
    description: "Bench-to-bedside, early-phase, mechanism-driven clinical.",
    journals: [
      "Nat Med",
      "Sci Transl Med",
      "J Clin Invest",
      "Cell Rep Med",
      "eLife",
      "Nature",
      "Cell",
      "N Engl J Med",
      "Lancet",
      "JAMA",
    ],
  },
  {
    id: "aging_longevity",
    name: "Aging / longevity",
    description: "Immune aging, senescence, healthspan.",
    journals: [
      "Nat Aging",
      "Aging Cell",
      "Cell Metab",
      "Cell",
      "Nature",
      "Nat Rev Mol Cell Biol",
      "eLife",
      "Cell Rep",
      "Immunity",
    ],
  },
  {
    id: "neuroscience",
    name: "Neuroscience",
    description: "Systems, cellular, and translational neuroscience.",
    journals: [
      "Neuron",
      "Nat Neurosci",
      "Cell",
      "Nature",
      "Science",
      "Sci Transl Med",
      "J Neurosci",
      "eLife",
    ],
  },
];

// Master list of all journals the user can add, drawn from the union of
// the sets above. This is also the set of journals the backend has RSS
// feed URLs for (or PubMed-per-journal fallback for).
export const ALL_KNOWN_JOURNALS: string[] = Array.from(
  new Set(JOURNAL_SETS.flatMap((s) => s.journals)),
).sort();
