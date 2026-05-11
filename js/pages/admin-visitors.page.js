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
import {
  listVisitorsDetailed,
  removeVisitor,
  removeVisitorLog,
  updateVisitorBundle,
  updateVisitorHistoryLog,
} from "../services/visitor.service.js";
import { mountTopbar } from "../ui/layout.js";
import { confirmModal, openFormModal } from "../ui/modal.js";
import { showToast } from "../ui/notifications.js";

let visitorState = [];

function renderTowerOptions() {
  return getTowerOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderApartmentOptions() {
  return getApartmentOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderVisitorCard(record) {
  return `
    <article class="panel record-card" data-visitor-id="${record.id}">
      <div class="record-card__header">
        <div class="record-card__title">
          <h2>${escapeHtml(record.plateDisplay)}</h2>
          <p>Creado: ${escapeHtml(toFriendlyDate(record.createdAt))}</p>
        </div>
        <div class="action-row">
          <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
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
        <article class="summary-item">
          <h3>Alertas</h3>
          <p>${record.history.filter((visit) => visit.entryMissing).length}</p>
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
      </div>
    </article>
  `;
}

function applyVisitorFilters() {
  const plate = qs("#visitor-filter-plate").value.trim().toLowerCase();
  const name = qs("#visitor-filter-name").value.trim().toLowerCase();
  const tower = qs("#visitor-filter-tower").value;
  const apartment = qs("#visitor-filter-apartment").value.trim().toLowerCase();
  const from = qs("#visitor-filter-date-from").value;
  const to = qs("#visitor-filter-date-to").value;

  return visitorState.filter((record) => {
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

    return matchesPlate && matchesName && matchesTower && matchesApartment && matchesFrom && matchesTo;
  });
}

function renderVisitorList() {
  const container = qs("#visitor-admin-list");
  const filtered = applyVisitorFilters();
  container.innerHTML = filtered.length
    ? filtered.map(renderVisitorCard).join("")
    : '<div class="panel empty-state">No se encontraron visitantes con los filtros actuales.</div>';
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
    visitorState = await listVisitorsDetailed();
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
    }
  });

  [
    "#visitor-filter-plate",
    "#visitor-filter-name",
    "#visitor-filter-tower",
    "#visitor-filter-apartment",
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

