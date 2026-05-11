import { supabase } from "../core/supabase-client.js";

export async function fetchCurrentProfile() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, role, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

