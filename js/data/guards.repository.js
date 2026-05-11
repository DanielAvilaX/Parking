import { supabase } from "../core/supabase-client.js";
import { ensureQueryResult } from "./repository-helpers.js";

export async function listGuardAccounts() {
  const result = await supabase.rpc("list_guard_accounts");
  return ensureQueryResult(result);
}

export async function createGuardAccount(email, password) {
  const result = await supabase.rpc("create_guard_account", {
    p_email: email,
    p_password: password,
  });
  return ensureQueryResult(result);
}

export async function updateGuardAccount(guardId, email, isActive) {
  const result = await supabase.rpc("update_guard_account", {
    p_guard_id: guardId,
    p_email: email,
    p_is_active: isActive,
  });
  return ensureQueryResult(result);
}

export async function resetGuardPassword(guardId, password) {
  const result = await supabase.rpc("reset_guard_password", {
    p_guard_id: guardId,
    p_password: password,
  });
  return ensureQueryResult(result);
}

export async function deleteGuardAccount(guardId) {
  const result = await supabase.rpc("delete_guard_account", {
    p_guard_id: guardId,
  });
  return ensureQueryResult(result);
}

