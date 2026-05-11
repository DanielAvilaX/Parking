import {
  buildApartmentLabel,
  canonicalizePlate,
  formatPlate,
  inferVehicleType,
  isValidApartment,
  isValidPlate,
  uniquePhones,
  uniqueStrings,
  groupBy,
  sortByText,
} from "../core/utils.js";
import {
  fetchApartments,
  fetchResidentApartments,
  fetchResidentPhones,
  fetchResidents,
  fetchResidentVehicles,
  insertResident,
  syncResidentApartments,
  syncResidentPhones,
  syncResidentVehicles,
  updateResident,
  deleteResident,
} from "../data/residents.repository.js";
import { fetchVisitorAccessLogs } from "../data/visitors.repository.js";

function buildApartmentMap(apartments) {
  return new Map(apartments.map((apartment) => [apartment.id, apartment]));
}

function hydrateResidentRecords({ residents, phones, vehicles, residentApartments, apartments, visitorLogs }) {
  const apartmentMap = buildApartmentMap(apartments);
  const phonesByResident = groupBy(phones, (phone) => phone.resident_id);
  const vehiclesByResident = groupBy(vehicles, (vehicle) => vehicle.resident_id);
  const apartmentLinksByResident = groupBy(residentApartments, (link) => link.resident_id);
  const residentIdsByApartment = groupBy(residentApartments, (link) => link.apartment_id);
  const visitorLogsByApartment = groupBy(visitorLogs, (log) => log.apartment_id || "none");
  const residentMap = new Map(residents.map((resident) => [resident.id, resident]));

  const records = residents.map((resident) => {
    const residentPhones = (phonesByResident.get(resident.id) || []).map((phone) => phone.phone);
    const residentVehicles = (vehiclesByResident.get(resident.id) || []).map((vehicle) => ({
      id: vehicle.id,
      plateDisplay: vehicle.plate_display,
      plateNormalized: vehicle.plate_normalized,
      vehicleType: vehicle.vehicle_type,
      createdAt: vehicle.created_at,
    }));

    const residentApartmentLinks = apartmentLinksByResident.get(resident.id) || [];
    const apartmentsForResident = residentApartmentLinks
      .map((link) => apartmentMap.get(link.apartment_id))
      .filter(Boolean)
      .map((apartment) => {
        const linksForApartment = residentIdsByApartment.get(apartment.id) || [];
        const relatedResidents = linksForApartment
          .map((link) => residentMap.get(link.resident_id))
          .filter(Boolean)
          .map((relatedResident) => ({
            id: relatedResident.id,
            fullName: relatedResident.full_name,
            phones: (phonesByResident.get(relatedResident.id) || []).map((phone) => phone.phone),
            vehicles: (vehiclesByResident.get(relatedResident.id) || []).map((vehicle) => vehicle.plate_display),
          }));

        return {
          id: apartment.id,
          tower: apartment.tower,
          floor: apartment.floor,
          apartmentNumber: apartment.apartment_number,
          label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
          relatedResidents: sortByText(relatedResidents, (item) => item.fullName),
          visitorHistory: visitorLogsByApartment.get(apartment.id) || [],
        };
      });

    return {
      id: resident.id,
      fullName: resident.full_name,
      createdAt: resident.created_at,
      updatedAt: resident.updated_at,
      phones: uniqueStrings(residentPhones),
      vehicles: residentVehicles,
      apartments: apartmentsForResident,
    };
  });

  return sortByText(records, (record) => record.fullName);
}

async function resolveApartmentIds(apartmentEntries) {
  const apartments = await Promise.all(
    apartmentEntries.map(async (entry) => {
      if (!isValidApartment(entry.tower, entry.apartmentNumber)) {
        throw new Error(`Apartamento inválido: torre ${entry.tower}, apto ${entry.apartmentNumber}.`);
      }

      const matches = await fetchApartments({
        tower: Number(entry.tower),
        apartmentNumber: String(entry.apartmentNumber),
      });

      if (!matches.length) {
        throw new Error(`No existe la combinación torre ${entry.tower} apartamento ${entry.apartmentNumber}.`);
      }

      return matches[0];
    })
  );

  return apartments;
}

export async function listResidentsDetailed() {
  const residents = await fetchResidents();
  const residentIds = residents.map((resident) => resident.id);
  const residentApartments = await fetchResidentApartments({ residentIds });
  const apartmentIds = [...new Set(residentApartments.map((link) => link.apartment_id))];
  const [phones, vehicles, apartments, visitorLogs] = await Promise.all([
    fetchResidentPhones({ residentIds }),
    fetchResidentVehicles({ residentIds }),
    apartmentIds.length ? fetchApartments({ ids: apartmentIds }) : Promise.resolve([]),
    apartmentIds.length ? fetchVisitorAccessLogs({ apartmentIds }) : Promise.resolve([]),
  ]);

  return hydrateResidentRecords({
    residents,
    phones,
    vehicles,
    residentApartments,
    apartments,
    visitorLogs,
  });
}

export async function searchResidentByPlate(rawPlate) {
  const normalized = canonicalizePlate(rawPlate);
  if (!normalized) {
    return null;
  }

  const vehicles = await fetchResidentVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    return null;
  }

  const residentId = vehicles[0].resident_id;
  const residents = await fetchResidents({ ids: [residentId] });
  const residentApartments = await fetchResidentApartments({ residentIds: [residentId] });
  const apartmentIds = residentApartments.map((link) => link.apartment_id);
  const allLinks = apartmentIds.length ? await fetchResidentApartments({ apartmentIds }) : [];
  const relatedResidentIds = [...new Set(allLinks.map((link) => link.resident_id))];
  const [phones, apartments, relatedResidents, relatedPhones, relatedVehicles, visitorLogs] = await Promise.all([
    fetchResidentPhones({ residentIds: [residentId] }),
    apartmentIds.length ? fetchApartments({ ids: apartmentIds }) : Promise.resolve([]),
    relatedResidentIds.length ? fetchResidents({ ids: relatedResidentIds }) : Promise.resolve([]),
    relatedResidentIds.length ? fetchResidentPhones({ residentIds: relatedResidentIds }) : Promise.resolve([]),
    relatedResidentIds.length ? fetchResidentVehicles({ residentIds: relatedResidentIds }) : Promise.resolve([]),
    apartmentIds.length ? fetchVisitorAccessLogs({ apartmentIds }) : Promise.resolve([]),
  ]);

  const records = hydrateResidentRecords({
    residents: [...residents, ...relatedResidents.filter((resident) => resident.id !== residentId)],
    phones: [...phones, ...relatedPhones],
    vehicles: [...vehicles, ...relatedVehicles.filter((vehicle) => vehicle.resident_id !== residentId)],
    residentApartments: [...residentApartments, ...allLinks.filter((link) => link.resident_id !== residentId)],
    apartments,
    visitorLogs,
  });

  return records.find((record) => record.id === residentId) || null;
}

export async function listResidentsForApartment(tower, apartmentNumber) {
  const apartments = await fetchApartments({ tower: Number(tower), apartmentNumber: String(apartmentNumber) });
  if (!apartments.length) {
    return [];
  }

  const links = await fetchResidentApartments({ apartmentIds: [apartments[0].id] });
  const residentIds = uniqueStrings(links.map((link) => link.resident_id));
  if (!residentIds.length) {
    return [];
  }

  const [residents, phones, vehicles] = await Promise.all([
    fetchResidents({ ids: residentIds }),
    fetchResidentPhones({ residentIds }),
    fetchResidentVehicles({ residentIds }),
  ]);

  const phonesByResident = groupBy(phones, (item) => item.resident_id);
  const vehiclesByResident = groupBy(vehicles, (item) => item.resident_id);

  return residents.map((resident) => ({
    id: resident.id,
    fullName: resident.full_name,
    phones: (phonesByResident.get(resident.id) || []).map((item) => item.phone),
    vehicles: (vehiclesByResident.get(resident.id) || []).map((item) => item.plate_display),
  }));
}

export async function createResidentBundle({ fullName, plate, phones, apartments, existingResidentId = null }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del residente no cumple con el formato permitido.");
  }

  if (!existingResidentId && !fullName.trim()) {
    throw new Error("Debes ingresar el nombre completo del propietario.");
  }

  const normalizedPhones = uniquePhones(phones);
  if (!normalizedPhones.length) {
    throw new Error("Debes registrar al menos un teléfono.");
  }

  if (!apartments.length) {
    throw new Error("Debes registrar al menos un apartamento.");
  }

  const apartmentRecords = await resolveApartmentIds(apartments);
  const apartmentIds = apartmentRecords.map((apartment) => apartment.id);
  const targetResidentId = existingResidentId || (await insertResident(fullName.trim())).id;

  await syncResidentPhones(targetResidentId, normalizedPhones, { replace: false });
  await syncResidentApartments(targetResidentId, apartmentIds, { replace: false });
  await syncResidentVehicles(
    targetResidentId,
    [
      {
        plateDisplay: formatPlate(plate),
        plateNormalized: canonicalizePlate(plate),
        vehicleType: inferVehicleType(plate),
      },
    ],
    { replace: false }
  );

  return targetResidentId;
}

export async function updateResidentBundle({ residentId, fullName, phones, apartments, vehicles }) {
  const apartmentRecords = await resolveApartmentIds(apartments);
  const apartmentIds = apartmentRecords.map((apartment) => apartment.id);
  const normalizedPhones = uniquePhones(phones);
  const normalizedVehicles = vehicles.map((vehicle) => {
    if (!isValidPlate(vehicle.plate)) {
      throw new Error(`La placa ${vehicle.plate} no es válida.`);
    }

    return {
      plateDisplay: formatPlate(vehicle.plate),
      plateNormalized: canonicalizePlate(vehicle.plate),
      vehicleType: inferVehicleType(vehicle.plate),
    };
  });

  await updateResident(residentId, fullName.trim());
  await syncResidentPhones(residentId, normalizedPhones, { replace: true });
  await syncResidentApartments(residentId, apartmentIds, { replace: true });
  await syncResidentVehicles(residentId, normalizedVehicles, { replace: true });
}

export async function removeResident(residentId) {
  await deleteResident(residentId);
}
