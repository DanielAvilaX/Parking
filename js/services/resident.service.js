import {
  buildApartmentLabel,
  canonicalizePlate,
  formatPlate,
  getLatestTimestamp,
  groupBy,
  inferVehicleType,
  isValidApartment,
  isValidPlate,
  uniquePhones,
  uniqueStrings,
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
import { fetchApartmentPhoneNumbers } from "../data/apartment-phones.repository.js";
import {
  deleteResidentAccessLog,
  fetchResidentAccessLogs,
  insertResidentAccessLog,
  updateResidentAccessLog,
} from "../data/resident-access.repository.js";
import { fetchVisitorAccessLogs } from "../data/visitors.repository.js";
import { ensureApartmentPrimaryPhone, syncApartmentPhonesFromResidents } from "./apartment-contact.service.js";

function buildApartmentMap(apartments) {
  return new Map(apartments.map((apartment) => [apartment.id, apartment]));
}

function buildResidentApartmentSnapshots(apartmentsForResident = []) {
  return apartmentsForResident.map((apartment) => ({
    apartmentId: apartment.id,
    tower: apartment.tower,
    apartmentNumber: apartment.apartment_number,
    label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
  }));
}

function hydrateResidentRecords({
  residents,
  phones,
  vehicles,
  residentApartments,
  apartments,
  visitorLogs,
  apartmentPhoneNumbers,
  residentAccessLogs,
}) {
  const apartmentMap = buildApartmentMap(apartments);
  const phonesByResident = groupBy(phones, (phone) => phone.resident_id);
  const vehiclesByResident = groupBy(vehicles, (vehicle) => vehicle.resident_id);
  const apartmentLinksByResident = groupBy(residentApartments, (link) => link.resident_id);
  const residentIdsByApartment = groupBy(residentApartments, (link) => link.apartment_id);
  const visitorLogsByApartment = groupBy(visitorLogs, (log) => log.apartment_id || "none");
  const residentMap = new Map(residents.map((resident) => [resident.id, resident]));
  const apartmentPhonesByApartment = groupBy(apartmentPhoneNumbers, (phone) => phone.apartment_id);
  const accessLogsByResident = groupBy(residentAccessLogs, (log) => log.resident_id);
  const accessLogsByVehicle = groupBy(residentAccessLogs, (log) => log.resident_vehicle_id);

  const records = residents.map((resident) => {
    const residentPhones = (phonesByResident.get(resident.id) || []).map((phone) => phone.phone);
    const residentVehicles = (vehiclesByResident.get(resident.id) || []).map((vehicle) => ({
      id: vehicle.id,
      plateDisplay: vehicle.plate_display,
      plateNormalized: vehicle.plate_normalized,
      vehicleType: vehicle.vehicle_type,
      createdAt: vehicle.created_at,
      accessHistory: (accessLogsByVehicle.get(vehicle.id) || [])
        .map((log) => ({
          id: log.id,
          plateDisplay: log.plate_display,
          plateNormalized: log.plate_normalized,
          residentNameSnapshot: log.resident_name_snapshot,
          apartmentSnapshots: log.apartment_snapshots || [],
          primaryApartmentPhoneSnapshot: log.primary_apartment_phone_snapshot,
          entryAt: log.entry_at,
          exitAt: log.exit_at,
          entryMissing: log.entry_missing,
          createdAt: log.created_at,
          updatedAt: log.updated_at,
        }))
        .sort(
          (left, right) =>
            getLatestTimestamp(right.exitAt, right.entryAt, right.updatedAt, right.createdAt) -
            getLatestTimestamp(left.exitAt, left.entryAt, left.updatedAt, left.createdAt)
        ),
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
        const apartmentPhones = (apartmentPhonesByApartment.get(apartment.id) || []).map((phone) => ({
          id: phone.id,
          phone: phone.phone,
          phoneNormalized: phone.phone_normalized,
          isPrimary: phone.is_primary,
        }));
        const primaryPhone = apartmentPhones.find((phone) => phone.isPrimary) || null;

        return {
          id: apartment.id,
          tower: apartment.tower,
          floor: apartment.floor,
          apartmentNumber: apartment.apartment_number,
          label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
          relatedResidents: sortByText(relatedResidents, (item) => item.fullName),
          visitorHistory: (visitorLogsByApartment.get(apartment.id) || []).sort(
            (left, right) =>
              getLatestTimestamp(
                right.exit_at,
                right.entry_at,
                right.announced_at,
                right.no_entry_at,
                right.updated_at,
                right.created_at
              ) -
              getLatestTimestamp(
                left.exit_at,
                left.entry_at,
                left.announced_at,
                left.no_entry_at,
                left.updated_at,
                left.created_at
              )
          ),
          phoneNumbers: apartmentPhones,
          primaryPhone,
          hasPrimaryPhone: Boolean(primaryPhone),
          missingPrimaryPhone: apartmentPhones.length > 0 && !primaryPhone,
        };
      });

    const residentHistory = (accessLogsByResident.get(resident.id) || [])
      .map((log) => ({
        id: log.id,
        residentId: log.resident_id,
        residentVehicleId: log.resident_vehicle_id,
        plateDisplay: log.plate_display,
        plateNormalized: log.plate_normalized,
        residentNameSnapshot: log.resident_name_snapshot,
        apartmentSnapshots: log.apartment_snapshots || [],
        primaryApartmentPhoneSnapshot: log.primary_apartment_phone_snapshot,
        entryAt: log.entry_at,
        exitAt: log.exit_at,
        entryMissing: log.entry_missing,
        createdAt: log.created_at,
        updatedAt: log.updated_at,
      }))
      .sort(
        (left, right) =>
          getLatestTimestamp(right.exitAt, right.entryAt, right.updatedAt, right.createdAt) -
          getLatestTimestamp(left.exitAt, left.entryAt, left.updatedAt, left.createdAt)
      );

    return {
      id: resident.id,
      fullName: resident.full_name,
      createdAt: resident.created_at,
      updatedAt: resident.updated_at,
      phones: uniqueStrings(residentPhones),
      vehicles: residentVehicles,
      apartments: apartmentsForResident,
      accessHistory: residentHistory,
      openAccessLogs: residentHistory.filter((log) => log.entryAt && !log.exitAt),
      missingPrimaryPhoneInAnyApartment: apartmentsForResident.some((apartment) => apartment.missingPrimaryPhone),
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

async function fetchResidentAccessContextByVehicle(vehicle) {
  const residentId = vehicle.resident_id;
  const [residents, residentApartmentLinks] = await Promise.all([
    fetchResidents({ ids: [residentId] }),
    fetchResidentApartments({ residentIds: [residentId] }),
  ]);

  const apartmentIds = uniqueStrings(residentApartmentLinks.map((link) => link.apartment_id));
  const [apartments, apartmentPhoneNumbers] = apartmentIds.length
    ? await Promise.all([
        fetchApartments({ ids: apartmentIds }),
        fetchApartmentPhoneNumbers({ apartmentIds }),
      ])
    : [[], []];

  const apartmentSnapshots = buildResidentApartmentSnapshots(apartments);
  const primaryPhone = apartmentPhoneNumbers.find((phone) => phone.is_primary)?.phone || null;
  const resident = residents[0] || null;

  return {
    resident,
    apartments,
    apartmentSnapshots,
    primaryPhone,
  };
}

export async function listResidentsDetailed() {
  const residents = await fetchResidents();
  const residentIds = residents.map((resident) => resident.id);
  const residentApartments = residentIds.length ? await fetchResidentApartments({ residentIds }) : [];
  const apartmentIds = uniqueStrings(residentApartments.map((link) => link.apartment_id));
  const residentVehicleRecords = residentIds.length ? await fetchResidentVehicles({ residentIds }) : [];
  const residentVehicleIds = residentVehicleRecords.map((vehicle) => vehicle.id);
  const [phones, apartments, visitorLogs, apartmentPhoneNumbers, residentAccessLogs] = await Promise.all([
    residentIds.length ? fetchResidentPhones({ residentIds }) : Promise.resolve([]),
    apartmentIds.length ? fetchApartments({ ids: apartmentIds }) : Promise.resolve([]),
    apartmentIds.length ? fetchVisitorAccessLogs({ apartmentIds }) : Promise.resolve([]),
    apartmentIds.length ? fetchApartmentPhoneNumbers({ apartmentIds }) : Promise.resolve([]),
    residentVehicleIds.length ? fetchResidentAccessLogs({ residentVehicleIds }) : Promise.resolve([]),
  ]);

  return hydrateResidentRecords({
    residents,
    phones,
    vehicles: residentVehicleRecords,
    residentApartments,
    apartments,
    visitorLogs,
    apartmentPhoneNumbers,
    residentAccessLogs,
  });
}

export async function searchResidentByPlate(rawPlate) {
  const normalized = canonicalizePlate(rawPlate);
  if (!normalized) {
    return null;
  }

  const matchedVehicles = await fetchResidentVehicles({ plateNormalized: normalized });
  if (!matchedVehicles.length) {
    return null;
  }

  const targetVehicle = matchedVehicles[0];
  const residentId = targetVehicle.resident_id;
  const residents = await fetchResidents({ ids: [residentId] });
  const residentApartments = await fetchResidentApartments({ residentIds: [residentId] });
  const apartmentIds = uniqueStrings(residentApartments.map((link) => link.apartment_id));
  const allLinks = apartmentIds.length ? await fetchResidentApartments({ apartmentIds }) : [];
  const relatedResidentIds = uniqueStrings(allLinks.map((link) => link.resident_id));
  const [phones, apartments, relatedResidents, relatedPhones, allRelatedVehicles, visitorLogs, apartmentPhoneNumbers, residentAccessLogs] =
    await Promise.all([
      fetchResidentPhones({ residentIds: [residentId] }),
      apartmentIds.length ? fetchApartments({ ids: apartmentIds }) : Promise.resolve([]),
      relatedResidentIds.length ? fetchResidents({ ids: relatedResidentIds }) : Promise.resolve([]),
      relatedResidentIds.length ? fetchResidentPhones({ residentIds: relatedResidentIds }) : Promise.resolve([]),
      relatedResidentIds.length ? fetchResidentVehicles({ residentIds: relatedResidentIds }) : Promise.resolve([]),
      apartmentIds.length ? fetchVisitorAccessLogs({ apartmentIds }) : Promise.resolve([]),
      apartmentIds.length ? fetchApartmentPhoneNumbers({ apartmentIds }) : Promise.resolve([]),
      relatedResidentIds.length ? fetchResidentAccessLogs({ residentIds: relatedResidentIds }) : Promise.resolve([]),
    ]);

  const records = hydrateResidentRecords({
    residents: [...residents, ...relatedResidents.filter((resident) => resident.id !== residentId)],
    phones: [...phones, ...relatedPhones],
    vehicles: allRelatedVehicles,
    residentApartments: [...residentApartments, ...allLinks.filter((link) => link.resident_id !== residentId)],
    apartments,
    visitorLogs,
    apartmentPhoneNumbers,
    residentAccessLogs,
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

  const [residents, phones, vehicles, apartmentPhoneNumbers] = await Promise.all([
    fetchResidents({ ids: residentIds }),
    fetchResidentPhones({ residentIds }),
    fetchResidentVehicles({ residentIds }),
    fetchApartmentPhoneNumbers({ apartmentIds: [apartments[0].id] }),
  ]);

  const phonesByResident = groupBy(phones, (item) => item.resident_id);
  const vehiclesByResident = groupBy(vehicles, (item) => item.resident_id);
  const primaryPhone = apartmentPhoneNumbers.find((phone) => phone.is_primary) || null;

  return residents.map((resident) => ({
    id: resident.id,
    fullName: resident.full_name,
    phones: (phonesByResident.get(resident.id) || []).map((item) => item.phone),
    vehicles: (vehiclesByResident.get(resident.id) || []).map((item) => item.plate_display),
    apartmentPhones: apartmentPhoneNumbers.map((phone) => ({
      id: phone.id,
      phone: phone.phone,
      phoneNormalized: phone.phone_normalized,
      isPrimary: phone.is_primary,
    })),
    primaryApartmentPhone: primaryPhone
      ? {
          id: primaryPhone.id,
          phone: primaryPhone.phone,
          phoneNormalized: primaryPhone.phone_normalized,
          isPrimary: true,
        }
      : null,
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
  await syncApartmentPhonesFromResidents(apartmentIds);
  await Promise.all(apartmentIds.map((apartmentId) => ensureApartmentPrimaryPhone(apartmentId, normalizedPhones)));

  return targetResidentId;
}

export async function updateResidentBundle({ residentId, fullName, phones, apartments, vehicles }) {
  const previousLinks = await fetchResidentApartments({ residentIds: [residentId] });
  const previousApartmentIds = uniqueStrings(previousLinks.map((link) => link.apartment_id));
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
  await syncApartmentPhonesFromResidents(uniqueStrings([...previousApartmentIds, ...apartmentIds]));
}

export async function recordResidentEntry({ plate }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del residente no es válida.");
  }

  const normalized = canonicalizePlate(plate);
  const vehicles = await fetchResidentVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    throw new Error("No existe un residente registrado con esa placa.");
  }

  const vehicle = vehicles[0];
  const existingLogs = await fetchResidentAccessLogs({ residentVehicleIds: [vehicle.id] });
  const openLog = existingLogs.find((log) => log.entry_at && !log.exit_at);
  const context = await fetchResidentAccessContextByVehicle(vehicle);

  const log = await insertResidentAccessLog({
    resident_id: vehicle.resident_id,
    resident_vehicle_id: vehicle.id,
    plate_display: vehicle.plate_display,
    plate_normalized: vehicle.plate_normalized,
    resident_name_snapshot: context.resident?.full_name || "Residente sin nombre",
    apartment_snapshots: context.apartmentSnapshots,
    primary_apartment_phone_snapshot: context.primaryPhone,
    entry_at: new Date().toISOString(),
    exit_at: null,
    entry_missing: false,
  });

  return {
    log,
    hadOpenLog: Boolean(openLog),
  };
}

export async function recordResidentExit({ plate }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del residente no es válida.");
  }

  const normalized = canonicalizePlate(plate);
  const vehicles = await fetchResidentVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    throw new Error("No existe un residente registrado con esa placa.");
  }

  const vehicle = vehicles[0];
  const existingLogs = await fetchResidentAccessLogs({ residentVehicleIds: [vehicle.id] });
  const openLog = existingLogs.find((log) => log.entry_at && !log.exit_at);

  if (openLog) {
    const log = await updateResidentAccessLog(openLog.id, {
      exit_at: new Date().toISOString(),
    });
    return {
      log,
      entryMissing: false,
      hadOpenLog: true,
    };
  }

  const context = await fetchResidentAccessContextByVehicle(vehicle);
  const log = await insertResidentAccessLog({
    resident_id: vehicle.resident_id,
    resident_vehicle_id: vehicle.id,
    plate_display: vehicle.plate_display,
    plate_normalized: vehicle.plate_normalized,
    resident_name_snapshot: context.resident?.full_name || "Residente sin nombre",
    apartment_snapshots: context.apartmentSnapshots,
    primary_apartment_phone_snapshot: context.primaryPhone,
    entry_at: null,
    exit_at: new Date().toISOString(),
    entry_missing: true,
  });

  return {
    log,
    entryMissing: true,
    hadOpenLog: false,
  };
}

export async function updateResidentAccessMovement({
  logId,
  entryAt,
  exitAt,
}) {
  return updateResidentAccessLog(logId, {
    entry_at: entryAt,
    exit_at: exitAt,
    entry_missing: !entryAt,
  });
}

export async function removeResidentAccessMovement(logId) {
  await deleteResidentAccessLog(logId);
}

export async function removeResident(residentId) {
  const previousLinks = await fetchResidentApartments({ residentIds: [residentId] });
  const apartmentIds = uniqueStrings(previousLinks.map((link) => link.apartment_id));
  await deleteResident(residentId);
  if (apartmentIds.length) {
    await syncApartmentPhonesFromResidents(apartmentIds);
  }
}
