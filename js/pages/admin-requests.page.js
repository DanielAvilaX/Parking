import { APP_ROLES, REQUEST_STATUS } from "../core/constants.js";
import { qs } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import { escapeHtml, matchesText, serializeError, toFriendlyDate } from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listAllRequests, removeRequest, setRequestStatus } from "../services/request.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js";
import { showToast } from "../ui/notifications.js";

let requestState = [];

function renderRequestCard(request) {
  const statusLabel =
    request.status === REQUEST_STATUS.APPROVED
      ? "Aprobada"
      : request.status === REQUEST_STATUS.REJECTED
        ? "Rechazada"
        : "Pendiente";

  const badgeClass =
    request.status === REQUEST_STATUS.APPROVED
      ? "badge-success"
      : request.status === REQUEST_STATUS.REJECTED
        ? "badge-danger"
        : "badge-warning";

  return `
    <article class="panel record-card">
      <div class="record-card__header">
        <div class="record-card__title">
          <h2>${escapeHtml(request.plate_display || "Sin placa")}</h2>
          <p>Creada: ${escapeHtml(toFriendlyDate(request.created_at))}</p>
        </div>
        <div class="badge-row">
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </div>
      </div>
      <p>${escapeHtml(request.message)}</p>
      <p class="muted">Contexto: ${escapeHtml(request.context_type)}</p>
      ${request.resolution_note ? `<p class="inline-note">Resolución: ${escapeHtml(request.resolution_note)}</p>` : ""}
      <div class="action-row">
        <button class="button" type="button" data-action="approve" data-request-id="${request.id}">Aprobar</button>
        <button class="button-danger" type="button" data-action="reject" data-request-id="${request.id}">Rechazar</button>
        <button class="button-danger" type="button" data-action="delete" data-request-id="${request.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function updateCounters(items) {
  qs("#request-count-pending").textContent = String(items.filter((item) => item.status === REQUEST_STATUS.PENDING).length);
  qs("#request-count-approved").textContent = String(items.filter((item) => item.status === REQUEST_STATUS.APPROVED).length);
  qs("#request-count-rejected").textContent = String(items.filter((item) => item.status === REQUEST_STATUS.REJECTED).length);
}

function applyRequestFilters() {
  const status = qs("#request-filter-status").value;
  const plate = qs("#request-filter-plate").value.trim().toLowerCase();
  return requestState.filter((request) => {
    const matchesStatus = status === "all" || request.status === status;
    const matchesPlate = !plate || matchesText(request.plate_display || "", plate);
    return matchesStatus && matchesPlate;
  });
}

function renderRequestList() {
  const items = applyRequestFilters();
  updateCounters(requestState);
  qs("#request-list").innerHTML = items.length
    ? items.map(renderRequestCard).join("")
    : '<div class="panel empty-state">No hay solicitudes que coincidan con este filtro.</div>';
}

function openResolutionModal(requestId, status, reload) {
  openFormModal({
    title: status === REQUEST_STATUS.APPROVED ? "Aprobar solicitud" : "Rechazar solicitud",
    description: "Puedes dejar una nota opcional para el histórico de revisión.",
    submitText: status === REQUEST_STATUS.APPROVED ? "Aprobar" : "Rechazar",
    danger: status === REQUEST_STATUS.REJECTED,
    content: `
      <div class="field">
        <label for="resolution-note">Nota de resolución</label>
        <textarea id="resolution-note" name="resolutionNote"></textarea>
      </div>
    `,
    onSubmit: async (formData) => {
      await setRequestStatus(requestId, status, formData.get("resolutionNote"));
      showToast("Solicitud actualizada correctamente.", "success");
      await reload();
    },
  });
}

async function initAdminRequestsPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.ADMIN,
    activeKey: "requests",
    subtitle: "Panel administrativo",
  });

  async function reload() {
    requestState = await listAllRequests();
    renderRequestList();
  }

  qs("#request-list").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const requestId = event.target.closest("[data-request-id]")?.dataset.requestId || event.target.dataset.requestId;
    if (!action || !requestId) {
      return;
    }

    if (action === "approve") {
      openResolutionModal(requestId, REQUEST_STATUS.APPROVED, reload);
    }

    if (action === "reject") {
      openResolutionModal(requestId, REQUEST_STATUS.REJECTED, reload);
    }

    if (action === "delete") {
      const request = requestState.find((item) => item.id === requestId);
      const confirmed = await confirmModal({
        title: "Eliminar solicitud",
        description: `Se eliminará la solicitud asociada a la placa ${request?.plate_display || "sin placa"}.`,
        confirmText: "Eliminar solicitud",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeRequest(requestId);
        showToast("Solicitud eliminada correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
    }
  });

  qs("#request-filter-status").addEventListener("change", renderRequestList);
  qs("#request-filter-plate").addEventListener("input", renderRequestList);

  try {
    await reload();
  } catch (error) {
    qs("#request-list").innerHTML = `<div class="panel empty-state">${escapeHtml(serializeError(error))}</div>`;
  }
}

initAdminRequestsPage();
