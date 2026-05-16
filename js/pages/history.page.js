import { APP_ROLES, ROUTES } from "../core/constants.js";
import { fillSelect, qs } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  buildApartmentLabel,
  escapeHtml,
  fromDateTimeInputValue,
  getApartmentOptions,
  getTowerOptions,
  matchesText,
  serializeError,
  toDateTimeInputValue,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listResidentHistoryRows, listVisitorHistoryRows } from "../services/history.service.js";
import { removeResidentAccessMovement, updateResidentAccessMovement } from "../services/resident.service.js";
import { markVisitorNoEntry, removeVisitorLog, updateVisitorHistoryLog } from "../services/visitor.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js?v=20260514-phase1c";
import { showToast } from "../ui/notifications.js";

let activeTab = "residents";
let residentHistoryState = [];
let visitorHistoryState = [];

function getRows() {
  return activeTab === "residents" ? residentHistoryState : visitorHistoryState;
}

function renderResidentHead() {
  return `
    <tr>
      <th>Placa</th>
      <th>Residente</th>
      <th>Apartamentos</th>
      <th>Ingreso</th>
      <th>Salida</th>
      <th>Alerta</th>
      <th>Acciones</th>
    </tr>
  `;
}

function renderVisitorHead() {
  return `
    <tr>
      <th>Placa</th>
      <th>Visitante</th>
      <th>Destino</th>
      <th>Residente</th>
      <th>Anuncio</th>
      <th>Ingreso</th>
      <th>Salida</th>
      <th>No ingresó</th>
      <th>Alerta</th>
      <th>Acciones</th>
    </tr>
  `;
}

function renderResidentRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="7">No hay movimientos de residentes con estos filtros.</td></tr>';
  }

  return rows
    .map(
      (row) => `
        <tr data-row-id="${row.id}">
          <td>${escapeHtml(row.plateDisplay)}</td>
          <td>${escapeHtml(row.residentName)}</td>
          <td>${escapeHtml(row.apartmentLabels.join(" · ") || "Sin apartamentos")}</td>
          <td>${escapeHtml(row.entryAt ? toFriendlyDate(row.entryAt) : "No registrada")}</td>
          <td>${escapeHtml(row.exitAt ? toFriendlyDate(row.exitAt) : "Pendiente")}</td>
          <td>${row.entryMissing ? '<span class="badge badge-danger">Sí</span>' : '<span class="badge">No</span>'}</td>
          <td>
            <div class="action-row">
              <button class="button-ghost" type="button" data-action="edit-resident-row" data-row-id="${row.id}">Editar</button>
              <button class="button-danger" type="button" data-action="delete-resident-row" data-row-id="${row.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderVisitorRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="10">No hay movimientos de visitantes con estos filtros.</td></tr>';
  }

  return rows
    .map(
      (row) => `
        <tr data-row-id="${row.id}">
          <td>${escapeHtml(row.plateDisplay)}</td>
          <td>${escapeHtml(row.visitorName || "Sin nombre")}</td>
          <td>${escapeHtml(row.apartmentLabel)}</td>
          <td>${escapeHtml(row.residentNamesSnapshot.join(", ") || "Sin residentes")}</td>
          <td>${escapeHtml(row.announcedAt ? toFriendlyDate(row.announcedAt) : "No registrado")}</td>
          <td>${escapeHtml(row.entryAt ? toFriendlyDate(row.entryAt) : "No registrada")}</td>
          <td>${escapeHtml(row.exitAt ? toFriendlyDate(row.exitAt) : "Pendiente")}</td>
          <td>${escapeHtml(row.noEntryAt ? toFriendlyDate(row.noEntryAt) : "No aplica")}</td>
          <td>${row.entryMissing ? '<span class="badge badge-danger">Sí</span>' : '<span class="badge">No</span>'}</td>
          <td>
            <div class="action-row">
              ${
                row.status === "announced"
                  ? `<button class="button-ghost" type="button" data-action="mark-no-entry" data-row-id="${row.id}">No ingresó</button>`
                  : ""
              }
              <button class="button-ghost" type="button" data-action="edit-visitor-row" data-row-id="${row.id}">Editar</button>
              <button class="button-danger" type="button" data-action="delete-visitor-row" data-row-id="${row.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function applyFilters() {
  const plate = qs("#history-filter-plate").value.trim().toLowerCase();
  const apartment = qs("#history-filter-apartment").value.trim().toLowerCase();
  const tower = qs("#history-filter-tower").value;
  const resident = qs("#history-filter-resident").value.trim().toLowerCase();
  const visitor = qs("#history-filter-visitor").value.trim().toLowerCase();
  const status = qs("#history-filter-status").value;
  const alerts = qs("#history-filter-alerts").value;
  const dateFrom = qs("#history-filter-date-from").value;
  const dateTo = qs("#history-filter-date-to").value;

  return getRows().filter((row) => {
    const candidateDate =
      row.exitAt || row.entryAt || row.noEntryAt || row.announcedAt || row.sortTimestamp || null;
    const dateObject = candidateDate ? new Date(candidateDate) : null;
    const matchesPlate = !plate || row.plateDisplay.toLowerCase().includes(plate);
    const matchesApartment =
      !apartment ||
      (activeTab === "residents"
        ? row.apartmentLabels.some((label) => label.toLowerCase().includes(apartment))
        : row.apartmentLabel.toLowerCase().includes(apartment));
    const matchesTower =
      !tower ||
      (activeTab === "residents"
        ? row.apartmentLabels.some((label) => label.toLowerCase().includes(`torre ${tower}`))
        : String(row.towerSnapshot) === tower);
    const matchesResident =
      !resident ||
      (activeTab === "residents"
        ? matchesText(row.residentName, resident)
        : row.residentNamesSnapshot.some((name) => matchesText(name, resident)));
    const matchesVisitor =
      !visitor || (activeTab === "visitors" ? matchesText(row.visitorName || "", visitor) : true);
    const matchesStatus = status === "all" || row.status === status;
    const matchesAlerts =
      alerts === "with-alerts"
        ? row.entryMissing
        : alerts === "without-alerts"
          ? !row.entryMissing
          : true;
    const matchesFrom = !dateFrom || (dateObject && dateObject >= new Date(`${dateFrom}T00:00:00`));
    const matchesTo = !dateTo || (dateObject && dateObject <= new Date(`${dateTo}T23:59:59`));

    return (
      matchesPlate &&
      matchesApartment &&
      matchesTower &&
      matchesResident &&
      matchesVisitor &&
      matchesStatus &&
      matchesAlerts &&
      matchesFrom &&
      matchesTo
    );
  });
}

function renderTable() {
  const rows = applyFilters();
  qs("#history-table-head").innerHTML = activeTab === "residents" ? renderResidentHead() : renderVisitorHead();
  qs("#history-table-body").innerHTML = activeTab === "residents" ? renderResidentRows(rows) : renderVisitorRows(rows);
}

function syncTabButtons() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === activeTab);
  });
}

function openResidentMovementEditModal(row, reload) {
  openFormModal({
    title: "Editar movimiento residente",
    description: `Placa ${row.plateDisplay}`,
    submitText: "Guardar cambios",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="resident-entry-at">Ingreso</label>
          <input id="resident-entry-at" name="entryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.entryAt))}" />
        </div>
        <div class="field">
          <label for="resident-exit-at">Salida</label>
          <input id="resident-exit-at" name="exitAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.exitAt))}" />
        </div>
      </div>
    `,
    onSubmit: async (formData) => {
      await updateResidentAccessMovement({
        logId: row.id,
        entryAt: fromDateTimeInputValue(formData.get("entryAt")),
        exitAt: fromDateTimeInputValue(formData.get("exitAt")),
      });
      showToast("Movimiento residente actualizado.", "success");
      await reload();
    },
  });
}

function renderTowerOptions() {
  return getTowerOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderApartmentOptions() {
  return getApartmentOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function openVisitorMovementEditModal(row, reload) {
  openFormModal({
    title: "Editar movimiento visitante",
    description: `Placa ${row.plateDisplay}`,
    submitText: "Guardar cambios",
    content: `
      <div class="field">
        <label for="visitor-history-name">Nombre visitante</label>
        <input id="visitor-history-name" name="visitorName" type="text" value="${escapeHtml(row.visitorName || "")}" required />
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="visitor-history-tower">Torre</label>
          <select id="visitor-history-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="visitor-history-apartment">Apartamento</label>
          <select id="visitor-history-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="visitor-history-announced">Anuncio</label>
          <input id="visitor-history-announced" name="announcedAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.announcedAt))}" />
        </div>
        <div class="field">
          <label for="visitor-history-entry">Ingreso</label>
          <input id="visitor-history-entry" name="entryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.entryAt))}" />
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="visitor-history-exit">Salida</label>
          <input id="visitor-history-exit" name="exitAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.exitAt))}" />
        </div>
        <div class="field">
          <label for="visitor-history-no-entry">No ingresó</label>
          <input id="visitor-history-no-entry" name="noEntryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(row.noEntryAt))}" />
        </div>
      </div>
    `,
    onOpen: (dialog) => {
      dialog.querySelector("#visitor-history-tower").value = String(row.towerSnapshot);
      dialog.querySelector("#visitor-history-apartment").value = String(row.apartmentNumberSnapshot);
    },
    onSubmit: async (formData) => {
      await updateVisitorHistoryLog({
        logId: row.id,
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
        announcedAt: fromDateTimeInputValue(formData.get("announcedAt")),
        entryAt: fromDateTimeInputValue(formData.get("entryAt")),
        exitAt: fromDateTimeInputValue(formData.get("exitAt")),
        noEntryAt: fromDateTimeInputValue(formData.get("noEntryAt")),
      });
      showToast("Movimiento visitante actualizado.", "success");
      await reload();
    },
  });
}

async function initHistoryPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN, APP_ROLES.GUARD]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: sessionProfile.profile.role,
    activeKey: "history",
    subtitle: sessionProfile.profile.role === APP_ROLES.ADMIN ? "Panel administrativo" : "Portería operativa",
  });

  fillSelect(qs("#history-filter-tower"), getTowerOptions(), "Todas las torres");

  async function reload() {
    const [residentRows, visitorRows] = await Promise.all([
      listResidentHistoryRows(),
      listVisitorHistoryRows(),
    ]);
    residentHistoryState = residentRows;
    visitorHistoryState = visitorRows;
    renderTable();
  }

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeTab = button.dataset.tab;
      syncTabButtons();
      renderTable();
    });
  });

  [
    "#history-filter-plate",
    "#history-filter-apartment",
    "#history-filter-tower",
    "#history-filter-resident",
    "#history-filter-visitor",
    "#history-filter-status",
    "#history-filter-alerts",
    "#history-filter-date-from",
    "#history-filter-date-to",
  ].forEach((selector) => {
    qs(selector).addEventListener("input", renderTable);
    qs(selector).addEventListener("change", renderTable);
  });

  qs("#history-table-body").addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
    const rowId = actionElement?.dataset.rowId;
    if (!actionElement || !action || !rowId) {
      return;
    }

    if (action === "edit-resident-row") {
      const row = residentHistoryState.find((item) => item.id === rowId);
      if (row) {
        openResidentMovementEditModal(row, reload);
      }
      return;
    }

    if (action === "delete-resident-row") {
      const confirmed = await confirmModal({
        title: "Eliminar movimiento residente",
        description: "Se eliminará el registro histórico seleccionado.",
        confirmText: "Eliminar movimiento",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeResidentAccessMovement(rowId);
        showToast("Movimiento eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
      return;
    }

    if (action === "edit-visitor-row") {
      const row = visitorHistoryState.find((item) => item.id === rowId);
      if (row) {
        openVisitorMovementEditModal(row, reload);
      }
      return;
    }

    if (action === "delete-visitor-row") {
      const confirmed = await confirmModal({
        title: "Eliminar movimiento visitante",
        description: "Se eliminará el registro histórico seleccionado.",
        confirmText: "Eliminar movimiento",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeVisitorLog(rowId);
        showToast("Movimiento eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
      return;
    }

    if (action === "mark-no-entry") {
      const confirmed = await confirmModal({
        title: "Marcar como no ingresó",
        description: "Este anuncio pasará al estado no ingresó.",
        confirmText: "Marcar no ingreso",
      });

      if (!confirmed) {
        return;
      }

      try {
        await markVisitorNoEntry({ logId: rowId });
        showToast("El anuncio fue marcado como no ingresó.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
    }
  });

  try {
    syncTabButtons();
    await reload();
  } catch (error) {
    qs("#history-table-body").innerHTML = `<tr><td colspan="10">${escapeHtml(serializeError(error))}</td></tr>`;
  }
}

initHistoryPage();
