import { buildApartmentLabel, getLatestTimestamp } from "../core/utils.js";
import { fetchResidentAccessLogs } from "../data/resident-access.repository.js";
import { fetchVisitorAccessLogs } from "../data/visitors.repository.js";
import { deriveVisitorVisitStatus } from "./visitor.service.js";

const RESIDENT_DELETED_PLACEHOLDER = "Residente eliminado";
const VISITOR_DELETED_PLACEHOLDER = "Visitante eliminado";

function deriveResidentHistoryStatus(log) {
  if (log.entry_missing) {
    return "exit-without-entry";
  }

  if (log.entry_at && !log.exit_at) {
    return "inside";
  }

  if (log.entry_at && log.exit_at) {
    return "completed";
  }

  return "unknown";
}

export async function listResidentHistoryRows() {
  const logs = await fetchResidentAccessLogs();

  return logs
    .map((log) => {
      const apartmentSnapshots = log.apartment_snapshots || [];
      return {
        id: log.id,
        residentId: log.resident_id,
        residentVehicleId: log.resident_vehicle_id,
        residentName: log.resident_name_snapshot || RESIDENT_DELETED_PLACEHOLDER,
        plateDisplay: log.plate_display,
        plateNormalized: log.plate_normalized,
        apartmentLabels: apartmentSnapshots.map(
          (snapshot) => snapshot.label || buildApartmentLabel(snapshot.tower, snapshot.apartmentNumber)
        ),
        primaryApartmentPhoneSnapshot: log.primary_apartment_phone_snapshot,
        entryAt: log.entry_at,
        exitAt: log.exit_at,
        entryMissing: log.entry_missing,
        status: deriveResidentHistoryStatus(log),
        sortTimestamp: getLatestTimestamp(log.exit_at, log.entry_at, log.updated_at, log.created_at),
      };
    })
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
}

export async function listVisitorHistoryRows() {
  const logs = await fetchVisitorAccessLogs();

  return logs
    .map((log) => ({
      id: log.id,
      visitorVehicleId: log.visitor_vehicle_id,
      plateDisplay: log.plate_display,
      plateNormalized: log.plate_normalized,
      visitorName: log.visitor_name || VISITOR_DELETED_PLACEHOLDER,
      towerSnapshot: log.tower_snapshot,
      apartmentNumberSnapshot: log.apartment_number_snapshot,
      apartmentLabel:
        log.tower_snapshot && log.apartment_number_snapshot
          ? buildApartmentLabel(log.tower_snapshot, log.apartment_number_snapshot)
          : "Sin apartamento",
      residentNamesSnapshot: log.resident_names_snapshot || [],
      apartmentPhonesSnapshot: log.apartment_phones_snapshot || [],
      primaryApartmentPhoneSnapshot: log.primary_apartment_phone_snapshot || null,
      announcedAt: log.announced_at,
      entryAt: log.entry_at,
      exitAt: log.exit_at,
      noEntryAt: log.no_entry_at,
      entryMissing: log.entry_missing,
      status: deriveVisitorVisitStatus(log),
      sortTimestamp: getLatestTimestamp(
        log.exit_at,
        log.entry_at,
        log.no_entry_at,
        log.announced_at,
        log.updated_at,
        log.created_at
      ),
    }))
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
}
