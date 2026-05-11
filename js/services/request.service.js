import { canonicalizePlate, formatPlate } from "../core/utils.js";
import { createRequest, deleteRequest, listRequests, updateRequestStatus } from "../data/requests.repository.js";

export async function submitChangeRequest({
  plate,
  message,
  contextType,
  relatedRecordId = null,
}) {
  return createRequest({
    plate_display: formatPlate(plate),
    plate_normalized: canonicalizePlate(plate),
    context_type: contextType,
    related_record_id: relatedRecordId,
    message: message.trim(),
    status: "pending",
  });
}

export async function listAllRequests() {
  return listRequests();
}

export async function setRequestStatus(requestId, status, resolutionNote = "") {
  return updateRequestStatus(requestId, {
    status,
    resolved_at: new Date().toISOString(),
    resolution_note: resolutionNote.trim() || null,
  });
}

export async function removeRequest(requestId) {
  return deleteRequest(requestId);
}
