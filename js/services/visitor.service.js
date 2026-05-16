import {
  buildApartmentLabel,
  canonicalizePlate,
  formatPlate,
  getLatestTimestamp,
  groupBy,
  inferVehicleType,
  isValidApartment,
  isValidPlate,
  uniqueStrings,
} from "../core/utils.js";
import { fetchApartments, fetchResidentApartments, fetchResidents } from "../data/residents.repository.js";
import { fetchApartmentPhoneNumbers } from "../data/apartment-phones.repository.js";
import {
  deleteVisitorAccessLog,
  deleteVisitorVehicle,
  fetchVisitorAccessLogs,
  fetchVisitorVehicles,
  insertVisitorAccessLog,
  insertVisitorVehicle,
  updateVisitorAccessLog,
  updateVisitorVehicle,
} from "../data/visitors.repository.js";
import { getApartmentContactContextById, getApartmentContactContextByLocation } from "./apartment-contact.service.js";

function deriveVisitorVisitStatus(visit) {
  if (visit.no_entry_at) {
    return "no-entry";
  }

  if (visit.entry_at && !visit.exit_at) {
    return "inside";
  }

  if (visit.entry_at && visit.exit_at) {
    return "completed";
  }

  if (!visit.entry_at && visit.exit_at && visit.entry_missing) {
    return "exit-without-entry";
  }

  if (visit.announced_at && !visit.entry_at) {
    return "announced";
  }

  return "created";
}

function buildVisitorRecords({
  vehicles,
  accessLogs,
  apartments,
  residentLinks,
  residents,
  apartmentPhoneNumbers,
}) {
  const apartmentMap = new Map(apartments.map((apartment) => [apartment.id, apartment]));
  const residentMap = new Map(residents.map((resident) => [resident.id, resident]));
  const accessLogsByVehicle = groupBy(accessLogs, (log) => log.visitor_vehicle_id);
  const residentIdsByApartment = groupBy(residentLinks, (link) => link.apartment_id);
  const apartmentPhonesByApartment = groupBy(apartmentPhoneNumbers, (phone) => phone.apartment_id);

  return vehicles
    .map((vehicle) => {
      const history = (accessLogsByVehicle.get(vehicle.id) || [])
        .map((visit) => ({
          id: visit.id,
          visitorName: visit.visitor_name,
          towerSnapshot: visit.tower_snapshot,
          apartmentNumberSnapshot: visit.apartment_number_snapshot,
          residentNamesSnapshot: visit.resident_names_snapshot || [],
          apartmentPhonesSnapshot: visit.apartment_phones_snapshot || [],
          primaryApartmentPhoneSnapshot: visit.primary_apartment_phone_snapshot,
          announcedAt: visit.announced_at,
          entryAt: visit.entry_at,
          exitAt: visit.exit_at,
          noEntryAt: visit.no_entry_at,
          entryMissing: visit.entry_missing,
          createdAt: visit.created_at,
          updatedAt: visit.updated_at,
          status: deriveVisitorVisitStatus(visit),
        }))
        .sort(
          (left, right) =>
            getLatestTimestamp(
              right.exitAt,
              right.entryAt,
              right.noEntryAt,
              right.announcedAt,
              right.updatedAt,
              right.createdAt
            ) -
            getLatestTimestamp(
              left.exitAt,
              left.entryAt,
              left.noEntryAt,
              left.announcedAt,
              left.updatedAt,
              left.createdAt
            )
        );
      const latestVisit = history[0] || null;
      const openVisit = history.find((visit) => visit.entryAt && !visit.exitAt) || null;
      const pendingAnnouncement =
        history.find((visit) => visit.announcedAt && !visit.entryAt && !visit.exitAt && !visit.noEntryAt) || null;
      const selectedApartmentId = vehicle.last_apartment_id;
      const apartment = apartmentMap.get(selectedApartmentId) || null;
      const relatedResidentLinks = selectedApartmentId ? residentIdsByApartment.get(selectedApartmentId) || [] : [];
      const currentResidents = relatedResidentLinks
        .map((link) => residentMap.get(link.resident_id))
        .filter(Boolean)
        .map((resident) => ({
          id: resident.id,
          fullName: resident.full_name,
        }));
      const apartmentPhones = (apartmentPhonesByApartment.get(selectedApartmentId) || []).map((phone) => ({
        id: phone.id,
        phone: phone.phone,
        phoneNormalized: phone.phone_normalized,
        isPrimary: phone.is_primary,
      }));
      const primaryPhone = apartmentPhones.find((phone) => phone.isPrimary) || null;

      return {
        id: vehicle.id,
        plateDisplay: vehicle.plate_display,
        plateNormalized: vehicle.plate_normalized,
        vehicleType: vehicle.vehicle_type,
        lastKnownName: vehicle.last_known_name,
        createdAt: vehicle.created_at,
        updatedAt: vehicle.updated_at,
        lastApartment: apartment
          ? {
              id: apartment.id,
              tower: apartment.tower,
              apartmentNumber: apartment.apartment_number,
              label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
            }
          : null,
        latestVisit,
        openVisit,
        pendingAnnouncement,
        history,
        currentResidents,
        currentPhones: apartmentPhones.map((phone) => phone.phone),
        currentApartmentPhones: apartmentPhones,
        currentPrimaryPhone: primaryPhone,
        missingPrimaryPhone: apartmentPhones.length > 0 && !primaryPhone,
      };
    })
    .sort((left, right) => getLatestTimestamp(right.updatedAt, right.createdAt) - getLatestTimestamp(left.updatedAt, left.createdAt));
}

async function resolveApartmentRecord(tower, apartmentNumber) {
  if (!isValidApartment(tower, apartmentNumber)) {
    throw new Error("La torre o el apartamento no son válidos.");
  }

  const apartments = await fetchApartments({
    tower: Number(tower),
    apartmentNumber: String(apartmentNumber),
  });

  if (!apartments.length) {
    throw new Error("No existe el apartamento indicado.");
  }

  return apartments[0];
}

async function ensureVisitorVehicle({ plate, visitorName, apartmentId }) {
  const normalized = canonicalizePlate(plate);
  const vehicles = await fetchVisitorVehicles({ plateNormalized: normalized });
  const existing = vehicles[0];

  if (existing) {
    return updateVisitorVehicle(existing.id, {
      plate_display: formatPlate(plate),
      plate_normalized: normalized,
      vehicle_type: inferVehicleType(plate),
      last_known_name: visitorName.trim(),
      last_apartment_id: apartmentId,
    });
  }

  return insertVisitorVehicle({
    plate_display: formatPlate(plate),
    plate_normalized: normalized,
    vehicle_type: inferVehicleType(plate),
    last_known_name: visitorName.trim(),
    last_apartment_id: apartmentId,
  });
}

function buildVisitorSnapshotPayload(vehicle, apartmentContext, visitorName) {
  return {
    visitor_vehicle_id: vehicle.id,
    plate_display: vehicle.plate_display,
    plate_normalized: vehicle.plate_normalized,
    visitor_name: visitorName.trim(),
    apartment_id: apartmentContext.apartment.id,
    tower_snapshot: apartmentContext.apartment.tower,
    apartment_number_snapshot: apartmentContext.apartment.apartment_number,
    resident_names_snapshot: apartmentContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: apartmentContext.apartmentPhones.map((phone) => phone.phone),
    primary_apartment_phone_snapshot: apartmentContext.primaryPhone?.phone || null,
  };
}

export async function getApartmentResidentsContext(tower, apartmentNumber) {
  const context = await getApartmentContactContextByLocation(tower, apartmentNumber);
  return {
    apartment: context.apartment,
    residents: context.residents,
    phones: context.apartmentPhones.map((phone) => phone.phone),
    apartmentPhones: context.apartmentPhones,
    primaryPhone: context.primaryPhone,
    hasPrimaryPhone: context.hasPrimaryPhone,
    missingPrimaryPhone: context.missingPrimaryPhone,
  };
}

export async function listVisitorsDetailed({ dateFrom = null, dateTo = null } = {}) {
  const vehicles = await fetchVisitorVehicles();
  const vehicleIds = vehicles.map((vehicle) => vehicle.id);
  const accessLogs = vehicleIds.length ? await fetchVisitorAccessLogs({ vehicleIds, dateFrom, dateTo }) : [];
  const apartmentIds = uniqueStrings([
    ...vehicles.map((vehicle) => vehicle.last_apartment_id).filter(Boolean),
    ...accessLogs.map((visit) => visit.apartment_id).filter(Boolean),
  ]);

  const [apartments, residentLinks, apartmentPhoneNumbers] = apartmentIds.length
    ? await Promise.all([
        fetchApartments({ ids: apartmentIds }),
        fetchResidentApartments({ apartmentIds }),
        fetchApartmentPhoneNumbers({ apartmentIds }),
      ])
    : [[], [], []];
  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const residents = residentIds.length ? await fetchResidents({ ids: residentIds }) : [];

  return buildVisitorRecords({
    vehicles,
    accessLogs,
    apartments,
    residentLinks,
    residents,
    apartmentPhoneNumbers,
  });
}

export async function searchVisitorByPlate(rawPlate) {
  const normalized = canonicalizePlate(rawPlate);
  if (!normalized) {
    return null;
  }

  const vehicles = await fetchVisitorVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    return null;
  }

  const vehicle = vehicles[0];
  const accessLogs = await fetchVisitorAccessLogs({ vehicleIds: [vehicle.id] });
  const apartmentIds = uniqueStrings(
    [vehicle.last_apartment_id, ...accessLogs.map((visit) => visit.apartment_id)].filter(Boolean)
  );

  const [apartments, residentLinks, apartmentPhoneNumbers] = apartmentIds.length
    ? await Promise.all([
        fetchApartments({ ids: apartmentIds }),
        fetchResidentApartments({ apartmentIds }),
        fetchApartmentPhoneNumbers({ apartmentIds }),
      ])
    : [[], [], []];
  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const residents = residentIds.length ? await fetchResidents({ ids: residentIds }) : [];

  return buildVisitorRecords({
    vehicles,
    accessLogs,
    apartments,
    residentLinks,
    residents,
    apartmentPhoneNumbers,
  })[0];
}

export async function registerVisitorVehicle({ plate, visitorName, tower, apartmentNumber }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no cumple con el formato permitido.");
  }

  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  return ensureVisitorVehicle({
    plate,
    visitorName,
    apartmentId: apartment.id,
  });
}

export async function announceVisitor({ plate, visitorName, tower, apartmentNumber }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no es válida.");
  }

  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const apartmentContext = await getApartmentContactContextById(apartment.id);
  const vehicle = await ensureVisitorVehicle({
    plate,
    visitorName,
    apartmentId: apartment.id,
  });

  return insertVisitorAccessLog({
    ...buildVisitorSnapshotPayload(vehicle, apartmentContext, visitorName),
    announced_at: new Date().toISOString(),
    entry_at: null,
    exit_at: null,
    no_entry_at: null,
    entry_missing: false,
  });
}

export async function recordVisitorEntry({ plate, visitorName, tower, apartmentNumber }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no es válida.");
  }

  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const apartmentContext = await getApartmentContactContextById(apartment.id);
  const vehicle = await ensureVisitorVehicle({
    plate,
    visitorName,
    apartmentId: apartment.id,
  });
  const accessLogs = await fetchVisitorAccessLogs({ vehicleIds: [vehicle.id] });
  const openLog = accessLogs.find((visit) => visit.entry_at && !visit.exit_at);
  const pendingAnnouncement = accessLogs.find(
    (visit) => visit.announced_at && !visit.entry_at && !visit.exit_at && !visit.no_entry_at
  );
  const payload = buildVisitorSnapshotPayload(vehicle, apartmentContext, visitorName);

  if (pendingAnnouncement) {
    const log = await updateVisitorAccessLog(pendingAnnouncement.id, {
      ...payload,
      entry_at: new Date().toISOString(),
      no_entry_at: null,
      exit_at: null,
      entry_missing: false,
    });

    return {
      log,
      hadOpenLog: Boolean(openLog),
      usedAnnouncement: true,
    };
  }

  const log = await insertVisitorAccessLog({
    ...payload,
    announced_at: new Date().toISOString(),
    entry_at: new Date().toISOString(),
    exit_at: null,
    no_entry_at: null,
    entry_missing: false,
  });

  return {
    log,
    hadOpenLog: Boolean(openLog),
    usedAnnouncement: false,
  };
}

export async function markVisitorNoEntry({ plate = null, logId = null }) {
  if (logId) {
    return updateVisitorAccessLog(logId, {
      no_entry_at: new Date().toISOString(),
      entry_at: null,
      exit_at: null,
      entry_missing: false,
    });
  }

  const normalized = canonicalizePlate(plate);
  const vehicles = await fetchVisitorVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    throw new Error("No existe un visitante registrado con esa placa.");
  }

  const vehicle = vehicles[0];
  const accessLogs = await fetchVisitorAccessLogs({ vehicleIds: [vehicle.id] });
  const pendingAnnouncement = accessLogs.find(
    (visit) => visit.announced_at && !visit.entry_at && !visit.exit_at && !visit.no_entry_at
  );

  if (!pendingAnnouncement) {
    throw new Error("No existe un anuncio pendiente para marcar como no ingresó.");
  }

  return updateVisitorAccessLog(pendingAnnouncement.id, {
    no_entry_at: new Date().toISOString(),
    entry_at: null,
    exit_at: null,
    entry_missing: false,
  });
}

export async function recordVisitorExit({ plate }) {
  const normalized = canonicalizePlate(plate);
  const vehicles = await fetchVisitorVehicles({ plateNormalized: normalized });
  if (!vehicles.length) {
    throw new Error("No existe un visitante registrado con esa placa.");
  }

  const vehicle = vehicles[0];
  const accessLogs = await fetchVisitorAccessLogs({ vehicleIds: [vehicle.id] });
  const openLog = accessLogs.find((visit) => visit.entry_at && !visit.exit_at);

  if (openLog) {
    const log = await updateVisitorAccessLog(openLog.id, {
      exit_at: new Date().toISOString(),
    });

    return {
      log,
      entryMissing: false,
      hadOpenLog: true,
    };
  }

  const apartmentContext = vehicle.last_apartment_id
    ? await getApartmentContactContextById(vehicle.last_apartment_id)
    : {
        apartment: null,
        residents: [],
        apartmentPhones: [],
        primaryPhone: null,
      };
  const payload =
    apartmentContext.apartment && apartmentContext.apartment.id
      ? buildVisitorSnapshotPayload(vehicle, apartmentContext, vehicle.last_known_name || "Visitante sin nombre reciente")
      : {
          visitor_vehicle_id: vehicle.id,
          plate_display: vehicle.plate_display,
          plate_normalized: vehicle.plate_normalized,
          visitor_name: vehicle.last_known_name || "Visitante sin nombre reciente",
          apartment_id: vehicle.last_apartment_id,
          tower_snapshot: apartmentContext.apartment?.tower || null,
          apartment_number_snapshot: apartmentContext.apartment?.apartment_number || null,
          resident_names_snapshot: apartmentContext.residents.map((resident) => resident.fullName),
          apartment_phones_snapshot: apartmentContext.apartmentPhones.map((phone) => phone.phone),
          primary_apartment_phone_snapshot: apartmentContext.primaryPhone?.phone || null,
        };

  const log = await insertVisitorAccessLog({
    ...payload,
    announced_at: null,
    entry_at: null,
    exit_at: new Date().toISOString(),
    no_entry_at: null,
    entry_missing: true,
  });

  return {
    log,
    entryMissing: true,
    hadOpenLog: false,
  };
}

export async function updateVisitorBundle({
  visitorId,
  plate,
  visitorName,
  tower,
  apartmentNumber,
}) {
  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no es válida.");
  }

  await updateVisitorVehicle(visitorId, {
    plate_display: formatPlate(plate),
    plate_normalized: canonicalizePlate(plate),
    vehicle_type: inferVehicleType(plate),
    last_known_name: visitorName.trim(),
    last_apartment_id: apartment.id,
  });
}

export async function updateVisitorHistoryLog({
  logId,
  visitorName,
  tower,
  apartmentNumber,
  announcedAt,
  entryAt,
  exitAt,
  noEntryAt,
}) {
  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const apartmentContext = await getApartmentContactContextById(apartment.id);
  await updateVisitorAccessLog(logId, {
    visitor_name: visitorName.trim(),
    apartment_id: apartment.id,
    tower_snapshot: apartment.tower,
    apartment_number_snapshot: apartment.apartment_number,
    resident_names_snapshot: apartmentContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: apartmentContext.apartmentPhones.map((phone) => phone.phone),
    primary_apartment_phone_snapshot: apartmentContext.primaryPhone?.phone || null,
    announced_at: announcedAt,
    entry_at: entryAt,
    exit_at: exitAt,
    no_entry_at: noEntryAt,
    entry_missing: !entryAt && Boolean(exitAt),
  });
}

export async function removeVisitor(visitorId) {
  await deleteVisitorVehicle(visitorId);
}

export async function removeVisitorLog(logId) {
  await deleteVisitorAccessLog(logId);
}
