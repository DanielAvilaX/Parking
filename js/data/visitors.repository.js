import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchVisitorVehicles({ ids = [], plateNormalized = null } = {}) {
  let query = supabase
    .from("visitor_vehicles")
    .select("id, plate_display, plate_normalized, vehicle_type, last_known_name, last_apartment_id, created_at, updated_at")
    .order("updated_at", { ascending: false });

  query = applyInFilter(query, "id", ids);

  if (plateNormalized) {
    query = query.eq("plate_normalized", plateNormalized);
  }

  return ensureQueryResult(await query);
}

export async function fetchVisitorAccessLogs({
  vehicleIds = [],
  apartmentIds = [],
  dateFrom = null,
  dateTo = null,
} = {}) {
  let query = supabase
    .from("visitor_access_logs")
    .select(
      "id, visitor_vehicle_id, plate_display, plate_normalized, visitor_name, apartment_id, tower_snapshot, apartment_number_snapshot, resident_names_snapshot, apartment_phones_snapshot, primary_apartment_phone_snapshot, announced_at, entry_at, exit_at, no_entry_at, entry_missing, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  query = applyInFilter(query, "visitor_vehicle_id", vehicleIds);
  query = applyInFilter(query, "apartment_id", apartmentIds);

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  return ensureQueryResult(await query);
}

export async function insertVisitorVehicle(payload) {
  return ensureQueryResult(
    await supabase
      .from("visitor_vehicles")
      .insert(payload)
      .select("id, plate_display, plate_normalized, vehicle_type, last_known_name, last_apartment_id, created_at, updated_at")
      .single()
  );
}

export async function updateVisitorVehicle(visitorVehicleId, payload) {
  return ensureQueryResult(
    await supabase
      .from("visitor_vehicles")
      .update(payload)
      .eq("id", visitorVehicleId)
      .select("id, plate_display, plate_normalized, vehicle_type, last_known_name, last_apartment_id, created_at, updated_at")
      .single()
  );
}

export async function deleteVisitorVehicle(visitorVehicleId) {
  const { error } = await supabase.from("visitor_vehicles").delete().eq("id", visitorVehicleId);
  if (error) {
    throw error;
  }
}

export async function insertVisitorAccessLog(payload) {
  return ensureQueryResult(
    await supabase
      .from("visitor_access_logs")
      .insert(payload)
      .select(
        "id, visitor_vehicle_id, plate_display, plate_normalized, visitor_name, apartment_id, tower_snapshot, apartment_number_snapshot, resident_names_snapshot, apartment_phones_snapshot, primary_apartment_phone_snapshot, announced_at, entry_at, exit_at, no_entry_at, entry_missing, created_at, updated_at"
      )
      .single()
  );
}

export async function updateVisitorAccessLog(accessLogId, payload) {
  return ensureQueryResult(
    await supabase
      .from("visitor_access_logs")
      .update(payload)
      .eq("id", accessLogId)
      .select(
        "id, visitor_vehicle_id, plate_display, plate_normalized, visitor_name, apartment_id, tower_snapshot, apartment_number_snapshot, resident_names_snapshot, apartment_phones_snapshot, primary_apartment_phone_snapshot, announced_at, entry_at, exit_at, no_entry_at, entry_missing, created_at, updated_at"
      )
      .single()
  );
}

export async function deleteVisitorAccessLog(accessLogId) {
  const { error } = await supabase.from("visitor_access_logs").delete().eq("id", accessLogId);
  if (error) {
    throw error;
  }
}
