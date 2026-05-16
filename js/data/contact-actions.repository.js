import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchContactActionLogs({
  apartmentIds = [],
  residentIds = [],
  visitorVehicleIds = [],
  porterOrderIds = [],
  actionType = null,
  contextType = null,
  plateNormalized = null,
  dateFrom = null,
  dateTo = null,
} = {}) {
  let query = supabase
    .from("contact_action_logs")
    .select(
      "id, action_type, context_type, apartment_id, resident_id, visitor_vehicle_id, porter_order_id, plate_display, plate_normalized, target_name, phone, phone_normalized, is_primary_phone, message_text, initiated_by, initiated_by_role, created_at"
    )
    .order("created_at", { ascending: false });

  query = applyInFilter(query, "apartment_id", apartmentIds);
  query = applyInFilter(query, "resident_id", residentIds);
  query = applyInFilter(query, "visitor_vehicle_id", visitorVehicleIds);
  query = applyInFilter(query, "porter_order_id", porterOrderIds);

  if (actionType) {
    query = query.eq("action_type", actionType);
  }

  if (contextType) {
    query = query.eq("context_type", contextType);
  }

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

export async function insertContactActionLog(payload) {
  return ensureQueryResult(
    await supabase
      .from("contact_action_logs")
      .insert(payload)
      .select(
        "id, action_type, context_type, apartment_id, resident_id, visitor_vehicle_id, porter_order_id, plate_display, plate_normalized, target_name, phone, phone_normalized, is_primary_phone, message_text, initiated_by, initiated_by_role, created_at"
      )
      .single()
  );
}
