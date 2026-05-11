import { supabase } from "../core/supabase-client.js";
import { ensureQueryResult } from "./repository-helpers.js";

export async function listRequests() {
  return ensureQueryResult(
    await supabase
      .from("change_requests")
      .select("id, plate_display, plate_normalized, context_type, related_record_id, message, status, created_at, updated_at, resolved_at, resolution_note, created_by")
      .order("created_at", { ascending: false })
  );
}

export async function createRequest(payload) {
  return ensureQueryResult(
    await supabase
      .from("change_requests")
      .insert(payload)
      .select("id, plate_display, plate_normalized, context_type, related_record_id, message, status, created_at, updated_at")
      .single()
  );
}

export async function updateRequestStatus(requestId, payload) {
  return ensureQueryResult(
    await supabase
      .from("change_requests")
      .update(payload)
      .eq("id", requestId)
      .select("id, plate_display, status, resolved_at, resolution_note")
      .single()
  );
}

export async function deleteRequest(requestId) {
  const { error } = await supabase.from("change_requests").delete().eq("id", requestId);
  if (error) {
    throw error;
  }
}
