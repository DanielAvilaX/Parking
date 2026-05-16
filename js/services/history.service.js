import { buildApartmentLabel, getLatestTimestamp } from "../core/utils.js";
import { listResidentsDetailed } from "./resident.service.js";
import { listVisitorsDetailed } from "./visitor.service.js";

function deriveResidentHistoryStatus(log) {
  if (log.entryMissing) {
    return "exit-without-entry";
  }

  if (log.entryAt && !log.exitAt) {
    return "inside";
  }

  if (log.entryAt && log.exitAt) {
    return "completed";
  }

  return "unknown";
}

export async function listResidentHistoryRows() {
  const residents = await listResidentsDetailed();
  return residents
    .flatMap((resident) =>
      resident.accessHistory.map((log) => ({
        id: log.id,
        residentId: resident.id,
        residentName: resident.fullName,
        plateDisplay: log.plateDisplay,
        plateNormalized: log.plateNormalized,
        apartmentLabels: (log.apartmentSnapshots || []).map(
          (snapshot) => snapshot.label || buildApartmentLabel(snapshot.tower, snapshot.apartmentNumber)
        ),
        primaryApartmentPhoneSnapshot: log.primaryApartmentPhoneSnapshot,
        entryAt: log.entryAt,
        exitAt: log.exitAt,
        entryMissing: log.entryMissing,
        status: deriveResidentHistoryStatus(log),
        sortTimestamp: getLatestTimestamp(log.exitAt, log.entryAt, log.updatedAt, log.createdAt),
      }))
    )
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
}

export async function listVisitorHistoryRows() {
  const visitors = await listVisitorsDetailed();
  return visitors
    .flatMap((vehicle) =>
      vehicle.history.map((log) => ({
        id: log.id,
        visitorVehicleId: vehicle.id,
        plateDisplay: vehicle.plateDisplay,
        plateNormalized: vehicle.plateNormalized,
        visitorName: log.visitorName,
        towerSnapshot: log.towerSnapshot,
        apartmentNumberSnapshot: log.apartmentNumberSnapshot,
        apartmentLabel: buildApartmentLabel(log.towerSnapshot, log.apartmentNumberSnapshot),
        residentNamesSnapshot: log.residentNamesSnapshot || [],
        apartmentPhonesSnapshot: log.apartmentPhonesSnapshot || [],
        primaryApartmentPhoneSnapshot: log.primaryApartmentPhoneSnapshot || null,
        announcedAt: log.announcedAt,
        entryAt: log.entryAt,
        exitAt: log.exitAt,
        noEntryAt: log.noEntryAt,
        entryMissing: log.entryMissing,
        status: log.status,
        sortTimestamp: getLatestTimestamp(
          log.exitAt,
          log.entryAt,
          log.noEntryAt,
          log.announcedAt,
          log.updatedAt,
          log.createdAt
        ),
      }))
    )
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
}
