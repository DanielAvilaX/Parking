import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchResidentAccessLogs({
  residentIds = [],
  residentVehicleIds = [],
  plateNormalized = null,
  dateFrom = null,
  dateTo = null,
} = {}) {
  let query = supabase
    .from("resident_access_logs")
    .select(
      "id, resident_id, resident_vehicle_id, plate_display, plate_normalized, resident_name_snapshot, apartment_snapshots, primary_apartment_phone_snapshot, entry_at, exit_at, entry_missing, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  query = applyInFilter(query, "resident_id", residentIds);
  query = applyInFilter(query, "resident_vehicle_id", residentVehicleIds);

  if (plateNormalized) {
    query = query.eq("plate_normalized", plateNormalized);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  return ensureQueryResult(await query);
}

export async function insertResidentAccessLog(payload) {
  return ensureQueryResult(
    await supabase
      .from("resident_access_logs")
      .insert(payload)
      .select(
        "id, resident_id, resident_vehicle_id, plate_display, plate_normalized, resident_name_snapshot, apartment_snapshots, primary_apartment_phone_snapshot, entry_at, exit_at, entry_missing, created_at, updated_at"
      )
      .single()
  );
}

export async function updateResidentAccessLog(accessLogId, payload) {
  return ensureQueryResult(
    await supabase
      .from("resident_access_logs")
      .update(payload)
      .eq("id", accessLogId)
      .select(
        "id, resident_id, resident_vehicle_id, plate_display, plate_normalized, resident_name_snapshot, apartment_snapshots, primary_apartment_phone_snapshot, entry_at, exit_at, entry_missing, created_at, updated_at"
      )
      .single()
  );
}

export async function deleteResidentAccessLog(accessLogId) {
  const { error } = await supabase.from("resident_access_logs").delete().eq("id", accessLogId);
  if (error) {
    throw error;
  }
}
