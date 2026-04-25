// Mirror of the Supabase rows we read. Field names are snake_case to match
// Postgres column names returned by PostgREST.

export interface PaperSummaryMethods {
  design: string;
  population_or_system: string;
  measures: string[];
}
export interface PaperSummaryFinding {
  statement: string;
  magnitude: string;
}
export interface PaperSummary {
  tldr: string;
  key_claim: string;
  methods: PaperSummaryMethods;
  findings: PaperSummaryFinding[];
  limitations: string[];
  relevance: { reason: string };
  tags_suggested: string[];
  confidence: number;
  figure_highlight?: string | null;
}

export interface Paper {
  id: string;
  user_id: string;
  source: string;
  source_id: string;
  doi: string | null;
  title: string;
  authors: string[];
  journal: string | null;
  published_at: string | null;
  abstract: string | null;
  url: string;
  summary: PaperSummary | null;
  confidence: number | null;
  relevance_score: number | null;
  first_author_institution: string | null;
  last_author_institution: string | null;
  hero_image_url: string | null;
  created_at: string | null;
}

export interface Briefing {
  id: string;
  user_id: string;
  briefing_date: string;
  audio_path: string | null;
  transcript: string | null;
  script_json: any;
  paper_ids: string[];
  generated_at: string;
}

export interface Profile {
  user_id: string;
  interest_text: string;
  suggested_queries: string[];
  suggested_journals: { name: string; feed_url?: string | null }[];
}
