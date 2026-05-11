import { supabase } from "../core/supabase-client.js";

export async function fetchCurrentProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
