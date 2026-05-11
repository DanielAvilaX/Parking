import { APP_ROLES } from "../core/constants.js";
import { qs, fillSelect } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  escapeHtml,
  getTowerOptions,
  matchesText,
  serializeError,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listResidentsDetailed, removeResident, updateResidentBundle } from "../services/resident.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js";
import { showToast } from "../ui/notifications.js";

let residentState = [];

function renderSummaryList(values, emptyLabel) {
  if (!values.length) {
    return `<p>${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="content-stack">
      ${values
        .map(
          (value) => `
            <div class="badge">${escapeHtml(value)}</div>
          `
        )
        .join("")}
    </div>
  `;
}

function parseLineList(value = "") {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseApartmentList(value = "") {
  return parseLineList(value).map((item) => {
    const normalized = item.replace(/\s+/g, "");
    const parts = normalized.split("-");
    if (parts.length !== 2) {
      throw new Error(`Apartamento inválido: ${item}. Usa el formato torre-apartamento, por ejemplo 2-304.`);
    }

    return {
      tower: parts[0],
      apartmentNumber: parts[1],
    };
  });
}

function renderResidentCard(record) {
  return `
    <article class="panel record-card" data-resident-id="${record.id}">
      <div class="record-card__header">
        <div class="record-card__title">
          <h2>${escapeHtml(record.fullName)}</h2>
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
          <h3>Placas</h3>
          ${renderSummaryList(record.vehicles.map((vehicle) => vehicle.plateDisplay), "Sin placas")}
        </article>
        <article class="summary-item">
          <h3>Teléfonos</h3>
          ${renderSummaryList(record.phones, "Sin teléfonos")}
        </article>
        <article class="summary-item">
          <h3>Apartamentos</h3>
          ${renderSummaryList(record.apartments.map((apartment) => apartment.label), "Sin apartamentos")}
        </article>
        <article class="summary-item">
          <h3>Visitantes históricos</h3>
          <p>${record.apartments.reduce((sum, apartment) => sum + apartment.visitorHistory.length, 0)}</p>
        </article>
      </div>
      <div class="details-panel" hidden>
        <div class="content-stack">
          ${record.apartments
            .map(
              (apartment) => `
                <article class="glass-card">
                  <div class="section-title">
                    <h3>${escapeHtml(apartment.label)}</h3>
                    <span class="helper-text">${apartment.relatedResidents.length} residente(s)</span>
                  </div>
                  <p class="muted">Residentes asociados: ${escapeHtml(
                    apartment.relatedResidents
                      .map(
                        (resident) =>
                          `${resident.fullName} · Teléfonos: ${resident.phones.join(", ") || "Sin teléfonos"} · Vehículos: ${
                            resident.vehicles.join(", ") || "Sin vehículos"
                          }`
                      )
                      .join(" | ") || "Sin residentes asociados"
                  )}</p>
                  <div class="table-wrap">
                    <div class="table-scroll">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Placa visitante</th>
                            <th>Nombre</th>
                            <th>Ingreso</th>
                            <th>Salida</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${
                            apartment.visitorHistory.length
                              ? apartment.visitorHistory
                                  .map(
                                    (visit) => `
                                      <tr>
                                        <td>${escapeHtml(visit.plate_display)}</td>
                                        <td>${escapeHtml(visit.visitor_name)}</td>
                                        <td>${escapeHtml(visit.entry_at ? toFriendlyDate(visit.entry_at) : "No registrada")}</td>
                                        <td>${escapeHtml(visit.exit_at ? toFriendlyDate(visit.exit_at) : "Pendiente")}</td>
                                      </tr>
                                    `
                                  )
                                  .join("")
                              : '<tr><td colspan="4">Sin visitas registradas para este apartamento.</td></tr>'
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    </article>
  `;
}

function applyFilters() {
  const tower = qs("#resident-filter-tower").value;
  const owner = qs("#resident-filter-owner").value.trim().toLowerCase();
  const apartment = qs("#resident-filter-apartment").value.trim().toLowerCase();
  const plate = qs("#resident-filter-plate").value.trim().toLowerCase();
  const phone = qs("#resident-filter-phone").value.trim().toLowerCase();

  return residentState.filter((record) => {
    const matchesTower = !tower || record.apartments.some((item) => String(item.tower) === tower);
    const matchesOwner = !owner || matchesText(record.fullName, owner);
    const matchesApartment =
      !apartment || record.apartments.some((item) => item.apartmentNumber.toLowerCase().includes(apartment));
    const matchesPlate =
      !plate || record.vehicles.some((vehicle) => vehicle.plateDisplay.toLowerCase().includes(plate));
    const matchesPhone = !phone || record.phones.some((item) => item.toLowerCase().includes(phone));

    return matchesTower && matchesOwner && matchesApartment && matchesPlate && matchesPhone;
  });
}

function renderResidentList() {
  const container = qs("#resident-admin-list");
  const filtered = applyFilters();

  container.innerHTML = filtered.length
    ? filtered.map(renderResidentCard).join("")
    : '<div class="panel empty-state">No se encontraron residentes con los filtros actuales.</div>';
}

function openResidentEditModal(record, reload) {
  openFormModal({
    title: "Editar residente",
    description: "Usa un elemento por línea. Apartamentos en formato torre-apartamento.",
    submitText: "Guardar cambios",
    content: `
      <div class="field">
        <label for="resident-full-name">Nombre completo</label>
        <input id="resident-full-name" name="fullName" type="text" value="${escapeHtml(record.fullName)}" required />
      </div>
      <div class="field">
        <label for="resident-phones-edit">Teléfonos</label>
        <textarea id="resident-phones-edit" name="phones">${escapeHtml(record.phones.join("\n"))}</textarea>
      </div>
      <div class="field">
        <label for="resident-vehicles-edit">Vehículos</label>
        <textarea id="resident-vehicles-edit" name="vehicles">${escapeHtml(
          record.vehicles.map((vehicle) => vehicle.plateDisplay).join("\n")
        )}</textarea>
      </div>
      <div class="field">
        <label for="resident-apartments-edit">Apartamentos</label>
        <textarea id="resident-apartments-edit" name="apartments">${escapeHtml(
          record.apartments.map((apartment) => `${apartment.tower}-${apartment.apartmentNumber}`).join("\n")
        )}</textarea>
      </div>
    `,
    onSubmit: async (formData) => {
      await updateResidentBundle({
        residentId: record.id,
        fullName: formData.get("fullName"),
        phones: parseLineList(formData.get("phones")),
        vehicles: parseLineList(formData.get("vehicles")).map((plate) => ({ plate })),
        apartments: parseApartmentList(formData.get("apartments")),
      });
      showToast("Residente actualizado correctamente.", "success");
      await reload();
    },
  });
}

async function initAdminResidentsPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.ADMIN,
    activeKey: "residents",
    subtitle: "Panel administrativo",
  });

  fillSelect(qs("#resident-filter-tower"), getTowerOptions(), "Todas las torres");

  async function reload() {
    residentState = await listResidentsDetailed();
    renderResidentList();
  }

  qs("#resident-admin-list").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) {
      return;
    }

    const residentCard = event.target.closest("[data-resident-id]");
    const record = residentState.find((resident) => resident.id === residentCard?.dataset.residentId);
    if (!record) {
      return;
    }

    if (action === "toggle-details") {
      const panel = residentCard.querySelector(".details-panel");
      panel.hidden = !panel.hidden;
      return;
    }

    if (action === "edit") {
      openResidentEditModal(record, reload);
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmModal({
        title: "Eliminar residente",
        description: "Se eliminarán sus relaciones actuales y vehículos asociados. Esta acción requiere confirmación.",
        confirmText: "Eliminar",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeResident(record.id);
        showToast("Residente eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error, "No fue posible eliminar el residente."), "error");
      }
    }
  });

  [
    "#resident-filter-tower",
    "#resident-filter-owner",
    "#resident-filter-apartment",
    "#resident-filter-plate",
    "#resident-filter-phone",
  ].forEach((selector) => {
    qs(selector).addEventListener("input", renderResidentList);
    qs(selector).addEventListener("change", renderResidentList);
  });

  try {
    await reload();
  } catch (error) {
    qs("#resident-admin-list").innerHTML = `<div class="panel empty-state">${escapeHtml(serializeError(error))}</div>`;
  }
}

initAdminResidentsPage();
