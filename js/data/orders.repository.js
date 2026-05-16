import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchPorterOrders({
  apartmentIds = [],
  statuses = [],
  dateFrom = null,
  dateTo = null,
} = {}) {
  let query = supabase
    .from("porter_orders")
    .select(
      "id, apartment_id, status, resident_names_snapshot, apartment_phones_snapshot, principal_phone_snapshot, notification_count, last_notified_phone, last_notification_message, received_at, notified_at, delivered_at, created_by, updated_by, created_at, updated_at"
    )
    .order("received_at", { ascending: false });

  query = applyInFilter(query, "apartment_id", apartmentIds);
  query = applyInFilter(query, "status", statuses);

  if (dateFrom) {
    query = query.gte("received_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("received_at", dateTo);
  }

  return ensureQueryResult(await query);
}

export async function insertPorterOrder(payload) {
  return ensureQueryResult(
    await supabase
      .from("porter_orders")
      .insert(payload)
      .select(
        "id, apartment_id, status, resident_names_snapshot, apartment_phones_snapshot, principal_phone_snapshot, notification_count, last_notified_phone, last_notification_message, received_at, notified_at, delivered_at, created_by, updated_by, created_at, updated_at"
      )
      .single()
  );
}

export async function updatePorterOrder(orderId, payload) {
  return ensureQueryResult(
    await supabase
      .from("porter_orders")
      .update(payload)
      .eq("id", orderId)
      .select(
        "id, apartment_id, status, resident_names_snapshot, apartment_phones_snapshot, principal_phone_snapshot, notification_count, last_notified_phone, last_notification_message, received_at, notified_at, delivered_at, created_by, updated_by, created_at, updated_at"
      )
      .single()
  );
}

export async function deletePorterOrder(orderId) {
  const { error } = await supabase.from("porter_orders").delete().eq("id", orderId);
  if (error) {
    throw error;
  }
}
