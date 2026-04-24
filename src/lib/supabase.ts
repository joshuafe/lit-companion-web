import { createClient } from "@supabase/supabase-js";

// Baked in at build time. Publishable key is safe for client — RLS enforces
// per-user isolation. To swap projects, edit these two constants.
export const SUPABASE_URL = "https://szwdguzrwkkhcjabkkjw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_lGCJ5PE3AZtCKpp4Za2jFg_CT_J3ogM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Persist sessions locally so "Add to Home Screen" retains login.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // catch the magic link hash on callback
  },
});

export const AUDIO_BUCKET = "briefings";

/**
 * Generate a short-lived signed URL for a storage object. Needed because the
 * bucket is private — direct URLs won't work without auth.
 */
export async function signedAudioURL(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
