// Curated journal bundles spanning all major fields of biology + medicine.
// User picks one (or more) at onboarding; the union becomes their
// suggested_journals which the Python pipeline uses for RSS ingestion.
//
// Editorial rules:
//   - 6–10 entries per bundle. Big enough to feel like coverage, small
//     enough that every entry is genuinely top-of-stack.
//   - Generalist flagships (Nature, Cell, NEJM…) only appear in bundles
//     where they're a primary venue for the specialty's work.
//   - "Tags" drive the relevance-sort on JournalsPage / OnboardingPage:
//     bundles whose tags overlap the user's interest_text float to top.

export interface JournalSet {
  id: string;
  name: string;
  description: string;
  journals: string[];
  /** Lowercase keywords matched against profile.interest_text for ranking. */
  tags: string[];
}

export const JOURNAL_SETS: JournalSet[] = [
  // ── Generalist ──────────────────────────────────────────────────────
  {
    id: "general_high_impact",
    name: "General high-impact",
    description: "Broad flagships that cover everything.",
    journals: [
      "Nature", "Science", "Cell",
      "N Engl J Med", "Lancet", "JAMA", "BMJ", "PNAS",
      "Nat Med", "Nat Commun", "eLife",
    ],
    tags: ["general", "biomedical", "broad"],
  },

  // ── Heme / Onc ──────────────────────────────────────────────────────
  {
    id: "clinical_heme_onc",
    name: "Clinical heme / onc",
    description: "Practice-changing trials and translational results.",
    journals: [
      "N Engl J Med", "Lancet", "Lancet Oncol", "Lancet Haematol",
      "JAMA", "JAMA Oncol", "Blood", "Blood Adv", "J Clin Oncol",
      "Nat Med", "Nat Cancer", "Cancer Cell", "Cell Rep Med",
      "Sci Transl Med", "J Clin Invest",
    ],
    tags: ["cancer", "leukemia", "lymphoma", "myeloma", "heme", "onc", "oncology", "hematology", "transplant", "hsct", "car-t"],
  },
  {
    id: "cancer_biology",
    name: "Cancer biology",
    description: "Tumor biology, microenvironment, mechanism.",
    journals: [
      "Cancer Cell", "Nat Cancer", "Nat Rev Cancer", "Cancer Discov",
      "Cell", "Nature", "Science", "Mol Cell", "Cell Rep",
      "Nat Med", "J Clin Invest",
    ],
    tags: ["cancer", "tumor", "tme", "metastasis", "oncogene", "tumor microenvironment"],
  },

  // ── Immunology ──────────────────────────────────────────────────────
  {
    id: "basic_immunology",
    name: "Basic immunology",
    description: "Mechanism-focused immunology flagships.",
    journals: [
      "Immunity", "Nat Immunol", "Sci Immunol", "J Exp Med",
      "Nat Rev Immunol", "Cell", "Nature", "Science",
      "eLife", "Cell Rep",
    ],
    tags: ["immune", "immunology", "t cell", "b cell", "macrophage", "cytokine", "innate", "adaptive"],
  },
  {
    id: "clinical_immunology_rheum",
    name: "Clinical immunology / rheumatology",
    description: "Autoimmunity, biologics, immunodeficiency.",
    journals: [
      "Ann Rheum Dis", "Arthritis Rheumatol", "Lancet Rheumatol",
      "Nat Rev Rheumatol", "J Allergy Clin Immunol",
      "N Engl J Med", "JAMA", "Lancet",
    ],
    tags: ["autoimmune", "rheumatology", "lupus", "ra", "arthritis", "ibd", "psoriasis"],
  },

  // ── Translational ───────────────────────────────────────────────────
  {
    id: "translational_med",
    name: "Translational medicine",
    description: "Bench-to-bedside, early-phase, mechanism-driven clinical.",
    journals: [
      "Nat Med", "Sci Transl Med", "J Clin Invest", "JCI Insight",
      "Cell Rep Med", "eLife", "Nature", "Cell",
      "N Engl J Med", "Lancet", "JAMA",
    ],
    tags: ["translational", "first-in-human", "phase 1", "biomarker", "mechanism"],
  },

  // ── Cardiovascular ──────────────────────────────────────────────────
  {
    id: "cardiology",
    name: "Cardiology",
    description: "Cardiovascular medicine, intervention, prevention.",
    journals: [
      "Circulation", "J Am Coll Cardiol", "Eur Heart J",
      "Nat Rev Cardiol", "JAMA Cardiol", "Lancet",
      "N Engl J Med", "Circ Res", "JACC Heart Fail",
    ],
    tags: ["cardio", "cardiology", "heart", "cardiovascular", "myocardial", "atherosclerosis", "hypertension", "heart failure"],
  },

  // ── Pulm / Critical care ────────────────────────────────────────────
  {
    id: "pulm_critical_care",
    name: "Pulmonary / critical care",
    description: "Respiratory disease, ICU medicine, sleep.",
    journals: [
      "Am J Respir Crit Care Med", "Eur Respir J",
      "Lancet Respir Med", "Chest", "Thorax",
      "JAMA", "N Engl J Med", "Crit Care Med",
    ],
    tags: ["pulm", "lung", "respiratory", "icu", "ards", "copd", "asthma", "sleep apnea", "critical care"],
  },

  // ── Infectious disease ──────────────────────────────────────────────
  {
    id: "infectious_disease",
    name: "Infectious disease",
    description: "Clinical ID, antimicrobials, emerging pathogens.",
    journals: [
      "Lancet Infect Dis", "Lancet Microbe", "Clin Infect Dis",
      "Nat Microbiol", "J Infect Dis", "Emerg Infect Dis",
      "N Engl J Med", "Lancet",
    ],
    tags: ["infection", "infectious", "antibiotic", "antimicrobial", "hiv", "tb", "tuberculosis", "covid", "sepsis"],
  },
  {
    id: "microbiology_virology",
    name: "Microbiology + virology",
    description: "Pathogen biology, host-microbe interaction, microbiome.",
    journals: [
      "Cell Host Microbe", "Nat Microbiol", "PLoS Pathog",
      "mBio", "Cell", "Nature", "Science",
      "J Virol", "Annu Rev Microbiol",
    ],
    tags: ["microbe", "microbiome", "virus", "viral", "bacteria", "pathogen", "host-pathogen", "fungal"],
  },

  // ── GI / Hepatology ─────────────────────────────────────────────────
  {
    id: "gastro_hepatology",
    name: "Gastroenterology + hepatology",
    description: "Luminal GI, IBD, liver, pancreas.",
    journals: [
      "Gastroenterology", "Gut", "Hepatology",
      "J Hepatol", "Lancet Gastroenterol Hepatol",
      "Clin Gastroenterol Hepatol", "Am J Gastroenterol",
      "Nat Rev Gastroenterol Hepatol", "Cell Host Microbe",
    ],
    tags: ["gi", "gastro", "gastroenterology", "ibd", "crohn", "colitis", "liver", "hepatitis", "cirrhosis", "pancreas", "microbiome"],
  },

  // ── Endo / metabolism ───────────────────────────────────────────────
  {
    id: "endocrinology_metabolism",
    name: "Endocrinology + metabolism",
    description: "Diabetes, obesity, bone, thyroid, mitochondria.",
    journals: [
      "Cell Metab", "Diabetes Care", "Lancet Diabetes Endocrinol",
      "Nat Rev Endocrinol", "Diabetes", "J Clin Endocrinol Metab",
      "Diabetologia", "Nat Med",
    ],
    tags: ["diabetes", "obesity", "metabolic", "endocrine", "thyroid", "insulin", "glp", "bone", "mitochondria"],
  },

  // ── Nephrology ──────────────────────────────────────────────────────
  {
    id: "nephrology",
    name: "Nephrology",
    description: "Kidney disease, dialysis, transplant.",
    journals: [
      "Kidney Int", "J Am Soc Nephrol", "Nat Rev Nephrol",
      "Am J Kidney Dis", "Clin J Am Soc Nephrol",
      "N Engl J Med", "JAMA",
    ],
    tags: ["kidney", "renal", "nephro", "dialysis", "ckd", "esrd", "glomerular"],
  },

  // ── Neurology / Neuroscience ────────────────────────────────────────
  {
    id: "clinical_neurology",
    name: "Clinical neurology",
    description: "Stroke, MS, epilepsy, dementia, movement disorders.",
    journals: [
      "Lancet Neurol", "Brain", "JAMA Neurol", "Neurology",
      "Ann Neurol", "Stroke",
      "N Engl J Med", "Lancet",
    ],
    tags: ["neurology", "stroke", "ms", "multiple sclerosis", "epilepsy", "alzheimer", "dementia", "parkinson", "neurological"],
  },
  {
    id: "neuroscience",
    name: "Basic neuroscience",
    description: "Systems, cellular, and molecular neuroscience.",
    journals: [
      "Neuron", "Nat Neurosci", "Cell", "Nature", "Science",
      "Sci Transl Med", "J Neurosci", "eLife",
      "Curr Biol", "PLoS Biol",
    ],
    tags: ["neuroscience", "neuron", "synapse", "circuit", "neurodevelopment", "glia", "behavior"],
  },

  // ── Psychiatry ──────────────────────────────────────────────────────
  {
    id: "psychiatry",
    name: "Psychiatry",
    description: "Mood, psychosis, addiction, neurodevelopment.",
    journals: [
      "Lancet Psychiatry", "JAMA Psychiatry", "Am J Psychiatry",
      "Mol Psychiatry", "Biol Psychiatry", "World Psychiatry",
      "N Engl J Med",
    ],
    tags: ["psychiatry", "depression", "anxiety", "psychosis", "schizophrenia", "addiction", "ptsd", "autism", "adhd"],
  },

  // ── Surgery + procedural ────────────────────────────────────────────
  {
    id: "surgery_general",
    name: "General + surgical specialties",
    description: "Outcomes, technique, perioperative.",
    journals: [
      "JAMA Surg", "Ann Surg", "Br J Surg",
      "Lancet", "N Engl J Med", "JAMA",
      "Surgery", "World J Surg",
    ],
    tags: ["surgery", "surgical", "operative", "perioperative", "trauma", "transplant"],
  },
  {
    id: "vascular_wound",
    name: "Vascular surgery + wound care",
    description: "Vascular disease, diabetic foot, wound healing, podiatry.",
    journals: [
      "J Vasc Surg", "Eur J Vasc Endovasc Surg", "Circulation",
      "Wound Repair Regen", "J Wound Care",
      "Diabetes Care", "JAMA Surg", "Lancet",
      "Plast Reconstr Surg",
    ],
    tags: ["vascular", "wound", "wound healing", "diabetic foot", "podiatry", "amputation", "ischemia", "ulcer", "vasculopathy"],
  },

  // ── Dermatology ─────────────────────────────────────────────────────
  {
    id: "dermatology",
    name: "Dermatology",
    description: "Inflammatory skin, oncology, dermatopathology.",
    journals: [
      "JAMA Dermatol", "Br J Dermatol", "J Invest Dermatol",
      "J Am Acad Dermatol", "Lancet",
      "N Engl J Med",
    ],
    tags: ["derm", "dermatology", "skin", "psoriasis", "atopic", "eczema", "melanoma"],
  },

  // ── Ophthalmology ───────────────────────────────────────────────────
  {
    id: "ophthalmology",
    name: "Ophthalmology",
    description: "Retina, glaucoma, cornea, vision science.",
    journals: [
      "JAMA Ophthalmol", "Ophthalmology", "Lancet",
      "Am J Ophthalmol", "Invest Ophthalmol Vis Sci",
      "Prog Retin Eye Res",
    ],
    tags: ["eye", "ophthalmology", "retina", "glaucoma", "cornea", "macular", "vision"],
  },

  // ── OB/GYN ──────────────────────────────────────────────────────────
  {
    id: "ob_gyn",
    name: "Obstetrics + gynecology",
    description: "Maternal-fetal, reproductive, gynecologic onc.",
    journals: [
      "Obstet Gynecol", "Am J Obstet Gynecol", "BJOG",
      "Hum Reprod", "Lancet", "N Engl J Med",
      "JAMA",
    ],
    tags: ["pregnancy", "maternal", "fetal", "obstetric", "gyn", "reproductive", "fertility", "preeclampsia"],
  },

  // ── Pediatrics ──────────────────────────────────────────────────────
  {
    id: "pediatrics",
    name: "Pediatrics",
    description: "General peds, neonatology, peds subspecialties.",
    journals: [
      "JAMA Pediatr", "Pediatrics", "Lancet Child Adolesc Health",
      "J Pediatr", "Arch Dis Child",
      "N Engl J Med", "Lancet",
    ],
    tags: ["peds", "pediatric", "neonatal", "infant", "childhood", "child"],
  },

  // ── Genetics / genomics ─────────────────────────────────────────────
  {
    id: "genetics_genomics",
    name: "Genetics + genomics",
    description: "Human genetics, functional genomics, evolution.",
    journals: [
      "Nat Genet", "Am J Hum Genet", "Genome Res",
      "Genome Biol", "Cell", "Nature", "Science",
      "Nat Methods", "PLoS Genet",
    ],
    tags: ["genetics", "genome", "genomic", "gwas", "variant", "mutation", "rna-seq", "single cell", "scrna"],
  },

  // ── Cell + structural biology ───────────────────────────────────────
  {
    id: "cell_structural",
    name: "Cell + structural biology",
    description: "Mechanism at the molecular and cellular scale.",
    journals: [
      "Cell", "Mol Cell", "Nat Cell Biol", "J Cell Biol",
      "Nat Struct Mol Biol", "Cell Rep", "EMBO J",
      "Curr Biol", "eLife",
    ],
    tags: ["cell biology", "structural", "cryo-em", "protein", "molecular", "organelle", "cytoskeleton"],
  },

  // ── Aging / longevity ───────────────────────────────────────────────
  {
    id: "aging_longevity",
    name: "Aging + longevity",
    description: "Senescence, healthspan, immune aging.",
    journals: [
      "Nat Aging", "Aging Cell", "Cell Metab",
      "Cell", "Nature", "Nat Rev Mol Cell Biol",
      "eLife", "Cell Rep", "Immunity",
    ],
    tags: ["aging", "senescence", "longevity", "geroscience", "healthspan"],
  },

  // ── Public health / epi ─────────────────────────────────────────────
  {
    id: "public_health_epi",
    name: "Public health + epidemiology",
    description: "Population health, prevention, policy.",
    journals: [
      "Lancet", "Lancet Public Health", "BMJ",
      "Am J Public Health", "Am J Epidemiol", "JAMA",
      "Health Aff (Millwood)",
    ],
    tags: ["epidemiology", "public health", "policy", "prevention", "population", "health equity"],
  },

  // ── Radiology / Imaging ─────────────────────────────────────────────
  {
    id: "radiology_imaging",
    name: "Radiology + imaging",
    description: "Diagnostic, interventional, AI for imaging.",
    journals: [
      "Radiology", "Lancet Digit Health", "Eur Radiol",
      "AJR Am J Roentgenol", "JAMA",
      "Nat Med",
    ],
    tags: ["radiology", "imaging", "mri", "ct", "ultrasound", "pet", "ai", "machine learning"],
  },

  // ── Pathology ───────────────────────────────────────────────────────
  {
    id: "pathology",
    name: "Pathology + lab medicine",
    description: "Histopathology, molecular path, digital pathology.",
    journals: [
      "Mod Pathol", "Am J Surg Pathol", "Lab Invest",
      "J Pathol", "Histopathology",
      "Nat Med",
    ],
    tags: ["pathology", "histopathology", "biopsy", "diagnostic", "molecular pathology"],
  },

  // ── Bioinformatics + computational ──────────────────────────────────
  {
    id: "bioinformatics",
    name: "Bioinformatics + computational",
    description: "Methods, ML for biology, single-cell, multi-omics.",
    journals: [
      "Nat Methods", "Bioinformatics", "Nat Comput Sci",
      "Genome Biol", "Nat Mach Intell", "Cell Syst",
      "Nat Biotechnol", "PLoS Comput Biol",
    ],
    tags: ["bioinformatics", "computational", "machine learning", "ai", "deep learning", "single cell", "multi-omics"],
  },

  // ── Plant biology ───────────────────────────────────────────────────
  {
    id: "plant_biology",
    name: "Plant biology",
    description: "Plant cell, dev, ag-genetics.",
    journals: [
      "Nature", "Cell", "Plant Cell", "Nat Plants",
      "Plant Physiol", "Curr Biol", "PNAS",
    ],
    tags: ["plant", "arabidopsis", "crop", "agriculture", "photosynthesis"],
  },

  // ── Ecology + evolution ─────────────────────────────────────────────
  {
    id: "ecology_evolution",
    name: "Ecology + evolution",
    description: "Population biology, biodiversity, evo-devo.",
    journals: [
      "Nature", "Science", "Nat Ecol Evol", "Ecol Lett",
      "Mol Biol Evol", "Curr Biol", "Trends Ecol Evol",
      "PNAS",
    ],
    tags: ["ecology", "evolution", "biodiversity", "population", "phylogenetic", "speciation"],
  },
];

// Master list of all journals the user can add, drawn from the union of
// the sets above. This is also the set of journals the backend has RSS
// feed URLs for (or PubMed-per-journal fallback for).
export const ALL_KNOWN_JOURNALS: string[] = Array.from(
  new Set(JOURNAL_SETS.flatMap((s) => s.journals)),
).sort();

// ─────────────────────────────────────────────────────────────────────
// Relevance ranking — used to surface bundles aligned to a user's
// interest_text first on the journals/onboarding pickers.
// ─────────────────────────────────────────────────────────────────────

/**
 * Score a bundle's relevance to a free-text interest description.
 * Simple keyword overlap — every tag that appears as a substring of
 * the (lowercased) interest counts as +1. Multi-word tags ("heart
 * failure", "diabetic foot") match the spirit of the interest more
 * strongly than single tokens, so they're weighted +2.
 *
 * Score is intentionally coarse — we only need a partial ordering, and
 * coarse weighting keeps the ranking interpretable when a user wants
 * to know why a bundle showed up.
 */
export function scoreSetByInterest(set: JournalSet, interestText: string): number {
  if (!interestText) return 0;
  const interest = interestText.toLowerCase();
  let score = 0;
  for (const tag of set.tags) {
    if (interest.includes(tag)) {
      score += tag.includes(" ") ? 2 : 1;
    }
  }
  return score;
}

/**
 * Return JOURNAL_SETS sorted by interest relevance (descending), with
 * ties broken by the canonical order in JOURNAL_SETS so the result is
 * stable across runs. Bundles with zero matches keep their original
 * relative order at the bottom.
 */
export function sortSetsByInterest(interestText: string): JournalSet[] {
  return JOURNAL_SETS
    .map((s, i) => ({ s, i, score: scoreSetByInterest(s, interestText) }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .map((x) => x.s);
}
