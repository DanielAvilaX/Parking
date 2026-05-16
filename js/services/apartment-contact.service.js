import { buildApartmentLabel, normalizePhone, uniquePhones, uniqueStrings } from "../core/utils.js";
import {
  clearApartmentPrimaryPhone,
  deleteApartmentPhoneNumbers,
  fetchApartmentPhoneNumbers,
  updateApartmentPhoneNumber,
  upsertApartmentPhoneNumbers,
} from "../data/apartment-phones.repository.js";
import {
  fetchApartments,
  fetchResidentApartments,
  fetchResidentPhones,
  fetchResidents,
  fetchResidentVehicles,
} from "../data/residents.repository.js";

function buildPhoneMapForApartment(apartmentId, residentLinks, phonesByResident) {
  const entries = new Map();
  for (const link of residentLinks) {
    const residentPhones = phonesByResident.get(link.resident_id) || [];
    for (const phone of residentPhones) {
      if (!phone.phone_normalized) {
        continue;
      }

      if (!entries.has(phone.phone_normalized)) {
        entries.set(phone.phone_normalized, {
          apartment_id: apartmentId,
          phone: phone.phone,
          phone_normalized: phone.phone_normalized,
          is_primary: false,
        });
      }
    }
  }

  return [...entries.values()];
}

export async function syncApartmentPhonesFromResidents(apartmentIds = []) {
  const normalizedApartmentIds = uniqueStrings(apartmentIds);
  if (!normalizedApartmentIds.length) {
    return [];
  }

  const [residentLinks, currentPhoneNumbers] = await Promise.all([
    fetchResidentApartments({ apartmentIds: normalizedApartmentIds }),
    fetchApartmentPhoneNumbers({ apartmentIds: normalizedApartmentIds }),
  ]);

  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const residentPhones = residentIds.length ? await fetchResidentPhones({ residentIds }) : [];
  const linksByApartment = residentLinks.reduce((map, link) => {
    if (!map.has(link.apartment_id)) {
      map.set(link.apartment_id, []);
    }
    map.get(link.apartment_id).push(link);
    return map;
  }, new Map());
  const phonesByResident = residentPhones.reduce((map, phone) => {
    if (!map.has(phone.resident_id)) {
      map.set(phone.resident_id, []);
    }
    map.get(phone.resident_id).push(phone);
    return map;
  }, new Map());
  const currentByApartment = currentPhoneNumbers.reduce((map, phone) => {
    if (!map.has(phone.apartment_id)) {
      map.set(phone.apartment_id, []);
    }
    map.get(phone.apartment_id).push(phone);
    return map;
  }, new Map());

  for (const apartmentId of normalizedApartmentIds) {
    const links = linksByApartment.get(apartmentId) || [];
    const desiredRecords = buildPhoneMapForApartment(apartmentId, links, phonesByResident);
    const currentRecords = currentByApartment.get(apartmentId) || [];
    const currentPrimary = currentRecords.find((phone) => phone.is_primary)?.phone_normalized || null;
    const desiredByNormalized = new Map(desiredRecords.map((record) => [record.phone_normalized, record]));

    if (desiredRecords.length) {
      await upsertApartmentPhoneNumbers(
        desiredRecords.map((record) => ({
          ...record,
          is_primary: currentPrimary ? currentPrimary === record.phone_normalized : false,
        }))
      );
    }

    const idsToDelete = currentRecords
      .filter((record) => !desiredByNormalized.has(record.phone_normalized))
      .map((record) => record.id);

    if (idsToDelete.length) {
      await deleteApartmentPhoneNumbers({ ids: idsToDelete });
    }
  }

  return fetchApartmentPhoneNumbers({ apartmentIds: normalizedApartmentIds });
}

export async function getApartmentContactContextById(apartmentId) {
  if (!apartmentId) {
    return {
      apartment: null,
      residents: [],
      residentPhones: [],
      apartmentPhones: [],
      primaryPhone: null,
      hasPrimaryPhone: false,
      missingPrimaryPhone: false,
    };
  }

  await syncApartmentPhonesFromResidents([apartmentId]);

  const [apartments, residentLinks, apartmentPhones] = await Promise.all([
    fetchApartments({ ids: [apartmentId] }),
    fetchResidentApartments({ apartmentIds: [apartmentId] }),
    fetchApartmentPhoneNumbers({ apartmentIds: [apartmentId] }),
  ]);

  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const [residents, residentPhones, residentVehicles] = residentIds.length
    ? await Promise.all([
        fetchResidents({ ids: residentIds }),
        fetchResidentPhones({ residentIds }),
        fetchResidentVehicles({ residentIds }),
      ])
    : [[], [], []];

  const phonesByResident = residentPhones.reduce((map, phone) => {
    if (!map.has(phone.resident_id)) {
      map.set(phone.resident_id, []);
    }
    map.get(phone.resident_id).push(phone.phone);
    return map;
  }, new Map());

  const vehiclesByResident = residentVehicles.reduce((map, vehicle) => {
    if (!map.has(vehicle.resident_id)) {
      map.set(vehicle.resident_id, []);
    }
    map.get(vehicle.resident_id).push(vehicle.plate_display);
    return map;
  }, new Map());

  const apartment = apartments[0] || null;
  const residentRecords = residents.map((resident) => ({
    id: resident.id,
    fullName: resident.full_name,
    phones: uniqueStrings(phonesByResident.get(resident.id) || []),
    vehicles: uniqueStrings(vehiclesByResident.get(resident.id) || []),
  }));
  const primaryPhone = apartmentPhones.find((phone) => phone.is_primary) || null;

  return {
    apartment: apartment
      ? {
          ...apartment,
          label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
        }
      : null,
    residents: residentRecords,
    residentPhones: uniquePhones(residentPhones.map((phone) => phone.phone)),
    apartmentPhones: apartmentPhones.map((phone) => ({
      id: phone.id,
      phone: phone.phone,
      phoneNormalized: phone.phone_normalized,
      isPrimary: phone.is_primary,
    })),
    primaryPhone: primaryPhone
      ? {
          id: primaryPhone.id,
          phone: primaryPhone.phone,
          phoneNormalized: primaryPhone.phone_normalized,
          isPrimary: true,
        }
      : null,
    hasPrimaryPhone: Boolean(primaryPhone),
    missingPrimaryPhone: apartmentPhones.length > 0 && !primaryPhone,
  };
}

export async function getApartmentContactContextByLocation(tower, apartmentNumber) {
  const apartments = await fetchApartments({
    tower: Number(tower),
    apartmentNumber: String(apartmentNumber),
  });

  if (!apartments.length) {
    throw new Error("No existe el apartamento indicado.");
  }

  return getApartmentContactContextById(apartments[0].id);
}

export async function setApartmentPrimaryPhone(apartmentId, phoneId) {
  const phoneNumbers = await fetchApartmentPhoneNumbers({ apartmentIds: [apartmentId] });
  const targetPhone = phoneNumbers.find((phone) => phone.id === phoneId);

  if (!targetPhone) {
    throw new Error("No fue posible encontrar el número seleccionado.");
  }

  await clearApartmentPrimaryPhone(apartmentId);
  await updateApartmentPhoneNumber(phoneId, { is_primary: true });
  return getApartmentContactContextById(apartmentId);
}

export async function ensureApartmentPrimaryPhone(apartmentId, preferredPhones = []) {
  const context = await getApartmentContactContextById(apartmentId);
  if (context.primaryPhone || !context.apartmentPhones.length) {
    return context;
  }

  const normalizedPreferredPhones = uniquePhones(preferredPhones).map((phone) => normalizePhone(phone));
  const preferredMatch = context.apartmentPhones.find((phone) =>
    normalizedPreferredPhones.includes(phone.phoneNormalized)
  );
  const targetPhone = preferredMatch || context.apartmentPhones[0];

  if (!targetPhone) {
    return context;
  }

  return setApartmentPrimaryPhone(apartmentId, targetPhone.id);
}
