import { supabase } from "../core/supabase-client.js";
import { applyInFilter, ensureQueryResult } from "./repository-helpers.js";

export async function fetchResidents({ ids = [] } = {}) {
  let query = supabase.from("residents").select("id, full_name, created_at, updated_at");
  query = applyInFilter(query, "id", ids);
  query = query.order("full_name");
  return ensureQueryResult(await query);
}

export async function fetchResidentPhones({ residentIds = [] } = {}) {
  let query = supabase.from("resident_phones").select("id, resident_id, phone, phone_normalized");
  query = applyInFilter(query, "resident_id", residentIds);
  query = query.order("phone");
  return ensureQueryResult(await query);
}

export async function fetchResidentVehicles({ residentIds = [], plateNormalized = null } = {}) {
  let query = supabase
    .from("resident_vehicles")
    .select("id, resident_id, plate_display, plate_normalized, vehicle_type, created_at")
    .order("created_at", { ascending: true });

  query = applyInFilter(query, "resident_id", residentIds);

  if (plateNormalized) {
    query = query.eq("plate_normalized", plateNormalized);
  }

  return ensureQueryResult(await query);
}

export async function fetchResidentApartments({ residentIds = [], apartmentIds = [] } = {}) {
  let query = supabase.from("resident_apartments").select("id, resident_id, apartment_id, created_at");
  query = applyInFilter(query, "resident_id", residentIds);
  query = applyInFilter(query, "apartment_id", apartmentIds);
  return ensureQueryResult(await query);
}

export async function fetchApartments({ ids = [], tower = null, apartmentNumber = null } = {}) {
  let query = supabase.from("apartments").select("id, tower, floor, apartment_number").order("tower").order("apartment_number");
  query = applyInFilter(query, "id", ids);

  if (tower) {
    query = query.eq("tower", tower);
  }

  if (apartmentNumber) {
    query = query.eq("apartment_number", apartmentNumber);
  }

  return ensureQueryResult(await query);
}

export async function insertResident(fullName) {
  const result = await supabase
    .from("residents")
    .insert({ full_name: fullName })
    .select("id, full_name, created_at, updated_at")
    .single();

  return ensureQueryResult(result);
}

export async function updateResident(residentId, fullName) {
  return ensureQueryResult(
    await supabase.from("residents").update({ full_name: fullName }).eq("id", residentId).select("id").single()
  );
}

export async function deleteResident(residentId) {
  const { error } = await supabase.from("residents").delete().eq("id", residentId);
  if (error) {
    throw error;
  }
}

export async function syncResidentPhones(residentId, phones, { replace = false } = {}) {
  if (replace) {
    const { error } = await supabase.from("resident_phones").delete().eq("resident_id", residentId);
    if (error) {
      throw error;
    }
  }

  if (!phones.length) {
    return [];
  }

  const payload = phones.map((phone) => ({
    resident_id: residentId,
    phone,
    phone_normalized: phone.replace(/\D/g, ""),
  }));

  if (!replace) {
    return ensureQueryResult(
      await supabase
        .from("resident_phones")
        .upsert(payload, { onConflict: "resident_id,phone_normalized", ignoreDuplicates: true })
        .select("id")
    );
  }

  return ensureQueryResult(await supabase.from("resident_phones").upsert(payload, { onConflict: "resident_id,phone_normalized" }).select("id"));
}

export async function syncResidentApartments(residentId, apartmentIds, { replace = false } = {}) {
  if (replace) {
    const { error } = await supabase.from("resident_apartments").delete().eq("resident_id", residentId);
    if (error) {
      throw error;
    }
  }

  if (!apartmentIds.length) {
    return [];
  }

  const payload = apartmentIds.map((apartmentId) => ({
    resident_id: residentId,
    apartment_id: apartmentId,
  }));

  if (!replace) {
    return ensureQueryResult(
      await supabase
        .from("resident_apartments")
        .upsert(payload, { onConflict: "resident_id,apartment_id", ignoreDuplicates: true })
        .select("id")
    );
  }

  return ensureQueryResult(await supabase.from("resident_apartments").upsert(payload, { onConflict: "resident_id,apartment_id" }).select("id"));
}

export async function syncResidentVehicles(residentId, vehicles, { replace = false } = {}) {
  if (replace) {
    const { error } = await supabase.from("resident_vehicles").delete().eq("resident_id", residentId);
    if (error) {
      throw error;
    }
  }

  if (!vehicles.length) {
    return [];
  }

  const payload = vehicles.map((vehicle) => ({
    resident_id: residentId,
    plate_display: vehicle.plateDisplay,
    plate_normalized: vehicle.plateNormalized,
    vehicle_type: vehicle.vehicleType,
  }));

  if (!replace) {
    return ensureQueryResult(
      await supabase
        .from("resident_vehicles")
        .upsert(payload, { onConflict: "plate_normalized", ignoreDuplicates: true })
        .select("id")
    );
  }

  return ensureQueryResult(await supabase.from("resident_vehicles").upsert(payload, { onConflict: "plate_normalized" }).select("id"));
}
