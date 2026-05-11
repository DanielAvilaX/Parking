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
import { fetchApartments, fetchResidentApartments, fetchResidentPhones, fetchResidents } from "../data/residents.repository.js";
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

async function fetchApartmentContext(apartmentId) {
  if (!apartmentId) {
    return {
      apartment: null,
      residents: [],
      phones: [],
    };
  }

  const [apartments, residentLinks] = await Promise.all([
    fetchApartments({ ids: [apartmentId] }),
    fetchResidentApartments({ apartmentIds: [apartmentId] }),
  ]);

  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const [residents, phones] = residentIds.length
    ? await Promise.all([fetchResidents({ ids: residentIds }), fetchResidentPhones({ residentIds })])
    : [[], []];

  return {
    apartment: apartments[0] || null,
    residents: residents.map((resident) => ({
      id: resident.id,
      fullName: resident.full_name,
    })),
    phones: uniqueStrings(phones.map((phone) => phone.phone)),
  };
}

function buildVisitorRecords({ vehicles, accessLogs, apartments, residentLinks, residents, phones }) {
  const apartmentMap = new Map(apartments.map((apartment) => [apartment.id, apartment]));
  const residentMap = new Map(residents.map((resident) => [resident.id, resident]));
  const accessLogsByVehicle = groupBy(accessLogs, (log) => log.visitor_vehicle_id);
  const residentIdsByApartment = groupBy(residentLinks, (link) => link.apartment_id);
  const phonesByResident = groupBy(phones, (phone) => phone.resident_id);

  return vehicles
    .map((vehicle) => {
      const history = (accessLogsByVehicle.get(vehicle.id) || []).sort(
        (left, right) => getLatestTimestamp(right.entry_at, right.exit_at, right.created_at) - getLatestTimestamp(left.entry_at, left.exit_at, left.created_at)
      );
      const latestVisit = history[0] || null;
      const openVisit = history.find((visit) => visit.entry_at && !visit.exit_at) || null;
      const currentApartmentId = latestVisit?.apartment_id || vehicle.last_apartment_id;
      const apartment = apartmentMap.get(currentApartmentId) || null;
      const relatedResidentLinks = currentApartmentId ? residentIdsByApartment.get(currentApartmentId) || [] : [];
      const currentResidents = relatedResidentLinks
        .map((link) => residentMap.get(link.resident_id))
        .filter(Boolean)
        .map((resident) => ({
          id: resident.id,
          fullName: resident.full_name,
        }));
      const currentPhones = uniqueStrings(
        relatedResidentLinks.flatMap((link) => (phonesByResident.get(link.resident_id) || []).map((phone) => phone.phone))
      );

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
        latestVisit: latestVisit
          ? {
              id: latestVisit.id,
              visitorName: latestVisit.visitor_name,
              towerSnapshot: latestVisit.tower_snapshot,
              apartmentNumberSnapshot: latestVisit.apartment_number_snapshot,
              residentNamesSnapshot: latestVisit.resident_names_snapshot || [],
              apartmentPhonesSnapshot: latestVisit.apartment_phones_snapshot || [],
              entryAt: latestVisit.entry_at,
              exitAt: latestVisit.exit_at,
              entryMissing: latestVisit.entry_missing,
            }
          : null,
        openVisit,
        history: history.map((visit) => ({
          id: visit.id,
          visitorName: visit.visitor_name,
          towerSnapshot: visit.tower_snapshot,
          apartmentNumberSnapshot: visit.apartment_number_snapshot,
          residentNamesSnapshot: visit.resident_names_snapshot || [],
          apartmentPhonesSnapshot: visit.apartment_phones_snapshot || [],
          entryAt: visit.entry_at,
          exitAt: visit.exit_at,
          entryMissing: visit.entry_missing,
        })),
        currentResidents,
        currentPhones,
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

export async function getApartmentResidentsContext(tower, apartmentNumber) {
  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const context = await fetchApartmentContext(apartment.id);
  return {
    apartment,
    residents: context.residents,
    phones: context.phones,
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

  const [apartments, residentLinks] = apartmentIds.length
    ? await Promise.all([fetchApartments({ ids: apartmentIds }), fetchResidentApartments({ apartmentIds })])
    : [[], []];
  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const [residents, phones] = residentIds.length
    ? await Promise.all([fetchResidents({ ids: residentIds }), fetchResidentPhones({ residentIds })])
    : [[], []];

  return buildVisitorRecords({
    vehicles,
    accessLogs,
    apartments,
    residentLinks,
    residents,
    phones,
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

  const [apartments, residentLinks] = apartmentIds.length
    ? await Promise.all([fetchApartments({ ids: apartmentIds }), fetchResidentApartments({ apartmentIds })])
    : [[], []];
  const residentIds = uniqueStrings(residentLinks.map((link) => link.resident_id));
  const [residents, phones] = residentIds.length
    ? await Promise.all([fetchResidents({ ids: residentIds }), fetchResidentPhones({ residentIds })])
    : [[], []];

  return buildVisitorRecords({
    vehicles,
    accessLogs,
    apartments,
    residentLinks,
    residents,
    phones,
  })[0];
}

export async function registerVisitorVehicle({ plate, visitorName, tower, apartmentNumber }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no cumple con el formato permitido.");
  }

  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  return insertVisitorVehicle({
    plate_display: formatPlate(plate),
    plate_normalized: canonicalizePlate(plate),
    vehicle_type: inferVehicleType(plate),
    last_known_name: visitorName.trim(),
    last_apartment_id: apartment.id,
  });
}

export async function recordVisitorEntry({ plate, visitorName, tower, apartmentNumber }) {
  if (!isValidPlate(plate)) {
    throw new Error("La placa del visitante no es válida.");
  }

  const normalized = canonicalizePlate(plate);
  let vehicles = await fetchVisitorVehicles({ plateNormalized: normalized });
  let vehicle = vehicles[0];
  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const apartmentContext = await fetchApartmentContext(apartment.id);

  if (!vehicle) {
    vehicle = await insertVisitorVehicle({
      plate_display: formatPlate(plate),
      plate_normalized: normalized,
      vehicle_type: inferVehicleType(plate),
      last_known_name: visitorName.trim(),
      last_apartment_id: apartment.id,
    });
  }

  return insertVisitorAccessLog({
    visitor_vehicle_id: vehicle.id,
    plate_display: vehicle.plate_display,
    plate_normalized: vehicle.plate_normalized,
    visitor_name: visitorName.trim(),
    apartment_id: apartment.id,
    tower_snapshot: apartment.tower,
    apartment_number_snapshot: apartment.apartment_number,
    resident_names_snapshot: apartmentContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: apartmentContext.phones,
    entry_at: new Date().toISOString(),
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
    return updateVisitorAccessLog(openLog.id, {
      exit_at: new Date().toISOString(),
    });
  }

  const context = await fetchApartmentContext(vehicle.last_apartment_id);
  return insertVisitorAccessLog({
    visitor_vehicle_id: vehicle.id,
    plate_display: vehicle.plate_display,
    plate_normalized: vehicle.plate_normalized,
    visitor_name: vehicle.last_known_name || "Visitante sin nombre reciente",
    apartment_id: vehicle.last_apartment_id,
    tower_snapshot: context.apartment?.tower || null,
    apartment_number_snapshot: context.apartment?.apartment_number || null,
    resident_names_snapshot: context.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: context.phones,
    entry_at: null,
    exit_at: new Date().toISOString(),
    entry_missing: true,
  });
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
  entryAt,
  exitAt,
}) {
  const apartment = await resolveApartmentRecord(tower, apartmentNumber);
  const apartmentContext = await fetchApartmentContext(apartment.id);
  await updateVisitorAccessLog(logId, {
    visitor_name: visitorName.trim(),
    apartment_id: apartment.id,
    tower_snapshot: apartment.tower,
    apartment_number_snapshot: apartment.apartment_number,
    resident_names_snapshot: apartmentContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: apartmentContext.phones,
    entry_at: entryAt,
    exit_at: exitAt,
    entry_missing: !entryAt,
  });
}

export async function removeVisitor(visitorId) {
  await deleteVisitorVehicle(visitorId);
}

export async function removeVisitorLog(logId) {
  await deleteVisitorAccessLog(logId);
}
