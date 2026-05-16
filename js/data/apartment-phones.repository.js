import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchApartmentPhoneNumbers({ ids = [], apartmentIds = [] } = {}) {
  let query = supabase
    .from("apartment_phone_numbers")
    .select("id, apartment_id, phone, phone_normalized, is_primary, created_at, updated_at")
    .order("apartment_id")
    .order("is_primary", { ascending: false })
    .order("phone");

  query = applyInFilter(query, "id", ids);
  query = applyInFilter(query, "apartment_id", apartmentIds);

  return ensureQueryResult(await query);
}

export async function upsertApartmentPhoneNumbers(records = []) {
  if (!records.length) {
    return [];
  }

  return ensureQueryResult(
    await supabase
      .from("apartment_phone_numbers")
      .upsert(records, { onConflict: "apartment_id,phone_normalized" })
      .select("id, apartment_id, phone, phone_normalized, is_primary, created_at, updated_at")
  );
}

export async function updateApartmentPhoneNumber(phoneId, payload) {
  return ensureQueryResult(
    await supabase
      .from("apartment_phone_numbers")
      .update(payload)
      .eq("id", phoneId)
      .select("id, apartment_id, phone, phone_normalized, is_primary, created_at, updated_at")
      .single()
  );
}

export async function clearApartmentPrimaryPhone(apartmentId) {
  return ensureQueryResult(
    await supabase
      .from("apartment_phone_numbers")
      .update({ is_primary: false })
      .eq("apartment_id", apartmentId)
      .select("id, apartment_id, phone, phone_normalized, is_primary, created_at, updated_at")
  );
}

export async function deleteApartmentPhoneNumbers({ ids = [], apartmentId = null } = {}) {
  if (!ids.length && !apartmentId) {
    return;
  }

  let query = supabase.from("apartment_phone_numbers").delete();
  query = applyInFilter(query, "id", ids);

  if (apartmentId) {
    query = query.eq("apartment_id", apartmentId);
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}
