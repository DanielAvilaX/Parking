import { APP_ROLES } from "../core/constants.js";
import { qs, fillSelect } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  buildApartmentLabel,
  escapeHtml,
  formatPlate,
  fromDateTimeInputValue,
  getApartmentOptions,
  getTowerOptions,
  matchesText,
  serializeError,
  toDateTimeInputValue,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listAllRequests, removeRequest, setRequestStatus } from "../services/request.service.js";
import {
  listVisitorsDetailed,
  removeVisitor,
  removeVisitorLog,
  updateVisitorBundle,
  updateVisitorHistoryLog,
} from "../services/visitor.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js";
import { showToast } from "../ui/notifications.js";

let visitorState = [];

function getAlertCount(record) {
  return record.history.filter((visit) => visit.entryMissing).length;
}

function renderRequestStatusBadge(request) {
  if (request.status === "approved") {
    return '<span class="badge badge-success">Aprobada</span>';
  }

  if (request.status === "rejected") {
    return '<span class="badge badge-danger">Rechazada</span>';
  }

  return '<span class="badge badge-warning">Pendiente</span>';
}

function renderVisitorRequestsSection(record) {
  return `
    <article class="glass-card" data-request-section>
      <div class="section-title">
        <h3>Solicitudes para esta placa</h3>
        <span class="helper-text">${record.requests.length} registro(s)</span>
      </div>
      <div class="table-wrap">
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Detalle</th>
                <th>Resolución</th>
              </tr>
            </thead>
            <tbody>
              ${
                record.requests.length
                  ? record.requests
                      .map(
                        (request) => `
                          <tr data-request-id="${request.id}">
                            <td>${escapeHtml(toFriendlyDate(request.created_at))}</td>
                            <td>${renderRequestStatusBadge(request)}</td>
                            <td>${escapeHtml(request.message)}</td>
                            <td>
                              <div class="action-row">
                                <span>${escapeHtml(request.resolution_note || "Pendiente de revisión")}</span>
                                ${
                                  request.status === "pending"
                                    ? `
                                      <button class="button-ghost" type="button" data-action="approve-request" data-request-id="${request.id}">Aprobar</button>
                                      <button class="button-danger" type="button" data-action="reject-request" data-request-id="${request.id}">Rechazar</button>
                                    `
                                    : ""
                                }
                                <button class="button-danger" type="button" data-action="delete-request" data-request-id="${request.id}">Eliminar</button>
                              </div>
                            </td>
                          </tr>
                        `
                      )
                      .join("")
                  : '<tr><td colspan="4">No hay solicitudes registradas para esta placa.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </article>
  `;
}

function renderTowerOptions() {
  return getTowerOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderApartmentOptions() {
  return getApartmentOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderVisitorCard(record) {
  const alertCount = getAlertCount(record);

  return `
    <article class="panel record-card" data-visitor-id="${record.id}">
      <div class="record-card__header">
        <div class="record-card__title">
          <h2>${escapeHtml(record.plateDisplay)}</h2>
          <p>Creado: ${escapeHtml(toFriendlyDate(record.createdAt))}</p>
        </div>
        <div class="action-row">
          <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
          <button class="button-ghost" type="button" data-action="toggle-details" aria-label="Expandir o contraer detalles">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
          <button class="button-ghost" type="button" data-action="view-requests">Solicitudes ${record.requests.length ? `(${record.requests.length})` : ""}</button>
          <button class="button" type="button" data-action="edit">Editar</button>
          <button class="button-danger" type="button" data-action="delete">Eliminar</button>
        </div>
      </div>
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Última persona anunciada</h3>
          <p>${escapeHtml(record.latestVisit?.visitorName || record.lastKnownName || "Sin nombre reciente")}</p>
        </article>
        <article class="summary-item">
          <h3>Último destino</h3>
          <p>${escapeHtml(record.latestVisit ? buildApartmentLabel(record.latestVisit.towerSnapshot, record.latestVisit.apartmentNumberSnapshot) : record.lastApartment?.label || "Sin destino")}</p>
        </article>
        <article class="summary-item">
          <h3>Estado</h3>
          <p>${record.openVisit ? "Dentro del conjunto" : "Fuera del conjunto"}</p>
        </article>
        <article class="summary-item ${alertCount ? "summary-item--alert is-critical" : ""}">
          <h3>Alertas</h3>
          <p>${alertCount}</p>
        </article>
        <article class="summary-item">
          <h3>Solicitudes</h3>
          <p>${record.requests.length}</p>
        </article>
      </div>
      <div class="details-panel" hidden>
        <article class="glass-card">
          <div class="section-title">
            <h3>Historial completo</h3>
          </div>
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Visitante</th>
                    <th>Destino</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    record.history.length
                      ? record.history
                          .map(
                            (visit) => `
                              <tr data-log-id="${visit.id}">
                                <td>${escapeHtml(visit.visitorName)}</td>
                                <td>${escapeHtml(buildApartmentLabel(visit.towerSnapshot, visit.apartmentNumberSnapshot))}</td>
                                <td>${escapeHtml(visit.entryAt ? toFriendlyDate(visit.entryAt) : "No registrada")}</td>
                                <td>${escapeHtml(visit.exitAt ? toFriendlyDate(visit.exitAt) : "Pendiente")}</td>
                                <td>
                                  <div class="action-row">
                                    ${visit.entryMissing ? '<span class="badge badge-danger">Salida sin ingreso</span>' : ""}
                                    <button class="button-ghost" type="button" data-action="edit-log" data-log-id="${visit.id}">Editar</button>
                                    <button class="button-danger" type="button" data-action="delete-log" data-log-id="${visit.id}">Eliminar</button>
                                  </div>
                                </td>
                              </tr>
                            `
                          )
                          .join("")
                      : '<tr><td colspan="5">Sin movimientos registrados.</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </div>
        </article>
        ${renderVisitorRequestsSection(record)}
      </div>
    </article>
  `;
}

function applyVisitorFilters() {
  const plate = qs("#visitor-filter-plate").value.trim().toLowerCase();
  const name = qs("#visitor-filter-name").value.trim().toLowerCase();
  const tower = qs("#visitor-filter-tower").value;
  const apartment = qs("#visitor-filter-apartment").value.trim().toLowerCase();
  const alertFilter = qs("#visitor-filter-alerts").value;
  const from = qs("#visitor-filter-date-from").value;
  const to = qs("#visitor-filter-date-to").value;

  return visitorState.filter((record) => {
    const alertCount = getAlertCount(record);
    const matchesPlate = !plate || record.plateDisplay.toLowerCase().includes(plate);
    const matchesName =
      !name ||
      matchesText(record.lastKnownName || "", name) ||
      record.history.some((visit) => matchesText(visit.visitorName || "", name));
    const matchesTower =
      !tower ||
      record.history.some((visit) => String(visit.towerSnapshot) === tower) ||
      String(record.lastApartment?.tower || "") === tower;
    const matchesApartment =
      !apartment ||
      record.history.some((visit) => String(visit.apartmentNumberSnapshot).toLowerCase().includes(apartment)) ||
      String(record.lastApartment?.apartmentNumber || "").toLowerCase().includes(apartment);
    const matchesFrom =
      !from ||
      record.history.some((visit) => {
        const date = new Date(visit.entryAt || visit.exitAt || record.createdAt);
        return date >= new Date(`${from}T00:00:00`);
      });
    const matchesTo =
      !to ||
      record.history.some((visit) => {
        const date = new Date(visit.entryAt || visit.exitAt || record.createdAt);
        return date <= new Date(`${to}T23:59:59`);
      });
    const matchesAlerts =
      alertFilter === "with-alerts"
        ? alertCount > 0
        : alertFilter === "without-alerts"
          ? alertCount === 0
          : true;

    return matchesPlate && matchesName && matchesTower && matchesApartment && matchesAlerts && matchesFrom && matchesTo;
  });
}

function renderVisitorList() {
  const container = qs("#visitor-admin-list");
  const filtered = applyVisitorFilters();
  container.innerHTML = filtered.length
    ? filtered.map(renderVisitorCard).join("")
    : '<div class="panel empty-state">No se encontraron visitantes con los filtros actuales.</div>';
}

function openRequestResolutionModal(record, request, status, reload) {
  openFormModal({
    title: status === "approved" ? "Aprobar solicitud" : "Rechazar solicitud",
    description: `Solicitud asociada a la placa ${record.plateDisplay}.`,
    submitText: status === "approved" ? "Aprobar" : "Rechazar",
    danger: status === "rejected",
    content: `
      <div class="field">
        <label for="request-resolution-note">Nota de resolución</label>
        <textarea id="request-resolution-note" name="resolutionNote" placeholder="Opcional"></textarea>
      </div>
    `,
    onSubmit: async (formData) => {
      await setRequestStatus(request.id, status, formData.get("resolutionNote"));
      showToast("Solicitud actualizada correctamente.", "success");
      await reload();
    },
  });
}

function openVisitorEditModal(record, reload) {
  openFormModal({
    title: "Editar visitante",
    description: "Modifica la placa, el último nombre conocido y el último apartamento relacionado.",
    submitText: "Guardar cambios",
    content: `
      <div class="field">
        <label for="visitor-plate-edit">Placa</label>
        <input id="visitor-plate-edit" name="plate" type="text" value="${escapeHtml(record.plateDisplay)}" required />
      </div>
      <div class="field">
        <label for="visitor-name-edit">Nombre reciente</label>
        <input id="visitor-name-edit" name="visitorName" type="text" value="${escapeHtml(record.lastKnownName || "")}" required />
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="visitor-tower-edit">Torre</label>
          <select id="visitor-tower-edit" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="visitor-apartment-edit">Apartamento</label>
          <select id="visitor-apartment-edit" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
    `,
    onOpen: (dialog) => {
      if (record.lastApartment) {
        dialog.querySelector("#visitor-tower-edit").value = String(record.lastApartment.tower);
        dialog.querySelector("#visitor-apartment-edit").value = record.lastApartment.apartmentNumber;
      }
    },
    onSubmit: async (formData) => {
      await updateVisitorBundle({
        visitorId: record.id,
        plate: formatPlate(formData.get("plate")),
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });
      showToast("Visitante actualizado correctamente.", "success");
      await reload();
    },
  });
}

function openHistoryEditModal(record, history, reload) {
  openFormModal({
    title: "Editar movimiento",
    description: "Puedes ajustar nombre, destino e indicadores de ingreso y salida.",
    submitText: "Guardar movimiento",
    content: `
      <div class="field">
        <label for="history-visitor-name">Nombre del visitante</label>
        <input id="history-visitor-name" name="visitorName" type="text" value="${escapeHtml(history.visitorName)}" required />
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="history-tower">Torre</label>
          <select id="history-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="history-apartment">Apartamento</label>
          <select id="history-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="history-entry-at">Ingreso</label>
          <input id="history-entry-at" name="entryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(history.entryAt))}" />
        </div>
        <div class="field">
          <label for="history-exit-at">Salida</label>
          <input id="history-exit-at" name="exitAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(history.exitAt))}" />
        </div>
      </div>
    `,
    onOpen: (dialog) => {
      dialog.querySelector("#history-tower").value = String(history.towerSnapshot);
      dialog.querySelector("#history-apartment").value = history.apartmentNumberSnapshot;
    },
    onSubmit: async (formData) => {
      await updateVisitorHistoryLog({
        logId: history.id,
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
        entryAt: fromDateTimeInputValue(formData.get("entryAt")),
        exitAt: fromDateTimeInputValue(formData.get("exitAt")),
      });
      showToast(`Movimiento de ${record.plateDisplay} actualizado.`, "success");
      await reload();
    },
  });
}

async function initAdminVisitorsPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.ADMIN,
    activeKey: "visitors",
    subtitle: "Panel administrativo",
  });

  fillSelect(qs("#visitor-filter-tower"), getTowerOptions(), "Todas las torres");

  async function reload() {
    const [visitors, requests] = await Promise.all([listVisitorsDetailed(), listAllRequests()]);
    const requestsByPlate = requests.reduce((map, request) => {
      const key = request.plate_normalized;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(request);
      return map;
    }, new Map());

    visitorState = visitors.map((visitor) => ({
      ...visitor,
      requests: requestsByPlate.get(visitor.plateNormalized) || [],
    }));
    renderVisitorList();
  }

  qs("#visitor-admin-list").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) {
      return;
    }

    const visitorCard = event.target.closest("[data-visitor-id]");
    const record = visitorState.find((visitor) => visitor.id === visitorCard?.dataset.visitorId);
    if (!record) {
      return;
    }

    if (action === "toggle-details") {
      const panel = visitorCard.querySelector(".details-panel");
      panel.hidden = !panel.hidden;
      return;
    }

    if (action === "view-requests") {
      const panel = visitorCard.querySelector(".details-panel");
      panel.hidden = false;
      visitorCard.querySelector("[data-request-section]")?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      return;
    }

    if (action === "edit") {
      openVisitorEditModal(record, reload);
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmModal({
        title: "Eliminar visitante",
        description: "Se eliminará el registro principal del vehículo visitante y su historial dependerá de la configuración de la base de datos.",
        confirmText: "Eliminar",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeVisitor(record.id);
        showToast("Visitante eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
      return;
    }

    if (action === "edit-log") {
      const logId = event.target.dataset.logId;
      const history = record.history.find((item) => item.id === logId);
      if (history) {
        openHistoryEditModal(record, history, reload);
      }
      return;
    }

    if (action === "delete-log") {
      const logId = event.target.dataset.logId;
      const confirmed = await confirmModal({
        title: "Eliminar movimiento",
        description: "Esta acción elimina un ingreso o salida histórica del visitante.",
        confirmText: "Eliminar movimiento",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeVisitorLog(logId);
        showToast("Movimiento eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
      return;
    }

    if (action === "approve-request" || action === "reject-request") {
      const requestId = event.target.dataset.requestId;
      const request = record.requests.find((item) => item.id === requestId);
      if (!request) {
        return;
      }

      openRequestResolutionModal(
        record,
        request,
        action === "approve-request" ? "approved" : "rejected",
        reload
      );
      return;
    }

    if (action === "delete-request") {
      const requestId = event.target.dataset.requestId;
      const request = record.requests.find((item) => item.id === requestId);
      if (!request) {
        return;
      }

      const confirmed = await confirmModal({
        title: "Eliminar solicitud",
        description: `Se eliminará la solicitud asociada a la placa ${record.plateDisplay}.`,
        confirmText: "Eliminar solicitud",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeRequest(request.id);
        showToast("Solicitud eliminada correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
    }
  });

  [
    "#visitor-filter-plate",
    "#visitor-filter-name",
    "#visitor-filter-tower",
    "#visitor-filter-apartment",
    "#visitor-filter-alerts",
    "#visitor-filter-date-from",
    "#visitor-filter-date-to",
  ].forEach((selector) => {
    qs(selector).addEventListener("input", renderVisitorList);
    qs(selector).addEventListener("change", renderVisitorList);
  });

  try {
    await reload();
  } catch (error) {
    qs("#visitor-admin-list").innerHTML = `<div class="panel empty-state">${escapeHtml(serializeError(error))}</div>`;
  }
}

initAdminVisitorsPage();
