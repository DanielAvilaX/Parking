import { APP_ROLES, ROUTES } from "../core/constants.js";
import { qs, setButtonLoading } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  buildApartmentLabel,
  canonicalizePlate,
  escapeHtml,
  formatPlate,
  getApartmentOptions,
  getQueryParam,
  getTowerOptions,
  isValidPlate,
  serializeError,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listResidentsForApartment, searchResidentByPlate } from "../services/resident.service.js";
import {
  getApartmentResidentsContext,
  recordVisitorEntry,
  recordVisitorExit,
  searchVisitorByPlate,
} from "../services/visitor.service.js";
import { submitChangeRequest } from "../services/request.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { openFormModal } from "../ui/modal.js";
import { showToast } from "../ui/notifications.js";

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

function renderApartmentOptions() {
  return getApartmentOptions().map((option) => `<option value="${option}">${option}</option>`).join("");
}

function renderTowerOptions() {
  return getTowerOptions().map((option) => `<option value="${option}">${option}</option>`).join("");
}

function renderResidentDetails(record) {
  return `
    <div class="details-panel" hidden>
      <div class="summary-grid">
        ${record.apartments
          .map(
            (apartment) => `
              <article class="summary-item">
                <h3>${escapeHtml(apartment.label)}</h3>
                <p>${escapeHtml(
                  apartment.relatedResidents.map((resident) => resident.fullName).join(", ") || "Sin residentes"
                )}</p>
              </article>
            `
          )
          .join("")}
      </div>
      <div class="content-stack">
        ${record.apartments
          .map(
            (apartment) => `
              <article class="glass-card">
                <div class="section-title">
                  <h3>${escapeHtml(apartment.label)}</h3>
                  <span class="helper-text">Visitantes históricos: ${apartment.visitorHistory.length}</span>
                </div>
                <p class="muted">Residentes asociados: ${escapeHtml(
                  apartment.relatedResidents
                    .map(
                      (resident) =>
                        `${resident.fullName} · Tel: ${resident.phones.join(", ") || "Sin teléfono"} · Vehículos: ${
                          resident.vehicles.join(", ") || "Sin vehículos"
                        }`
                    )
                    .join(" | ") || "Sin residentes relacionados"
                )}</p>
                <div class="table-wrap">
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Visitante</th>
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
                                      <td>${escapeHtml(toFriendlyDate(visit.entry_at))}</td>
                                      <td>${escapeHtml(visit.exit_at ? toFriendlyDate(visit.exit_at) : "Pendiente")}</td>
                                    </tr>
                                  `
                                )
                                .join("")
                            : '<tr><td colspan="4">Sin historial para este apartamento.</td></tr>'
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
  `;
}

function renderVisitorDetails(record) {
  return `
    <div class="details-panel" hidden>
      <div class="content-stack">
        <article class="glass-card">
          <div class="summary-grid">
            <div class="summary-item">
              <h3>Creación del visitante</h3>
              <p>${escapeHtml(toFriendlyDate(record.createdAt))}</p>
            </div>
            <div class="summary-item">
              <h3>Personas anunciadas</h3>
              <p>${escapeHtml([...new Set(record.history.map((visit) => visit.visitorName).filter(Boolean))].join(", ") || "Sin historial")}</p>
            </div>
            <div class="summary-item">
              <h3>Residentes del apartamento</h3>
              <p>${escapeHtml(record.currentResidents.map((resident) => resident.fullName).join(", ") || "Sin residentes")}</p>
            </div>
            <div class="summary-item">
              <h3>Teléfonos del apartamento</h3>
              <p>${escapeHtml(record.currentPhones.join(", ") || "Sin teléfonos")}</p>
            </div>
          </div>
        </article>
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
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    record.history.length
                      ? record.history
                          .map(
                            (visit) => `
                              <tr>
                                <td>${escapeHtml(visit.visitorName)}</td>
                                <td>${escapeHtml(buildApartmentLabel(visit.towerSnapshot, visit.apartmentNumberSnapshot))}</td>
                                <td>${escapeHtml(visit.entryAt ? toFriendlyDate(visit.entryAt) : "No registrada")}</td>
                                <td>${escapeHtml(visit.exitAt ? toFriendlyDate(visit.exitAt) : "Pendiente")}</td>
                                <td>${visit.entryMissing ? '<span class="badge badge-danger">Salida sin ingreso</span>' : '<span class="badge badge-success">Normal</span>'}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : '<tr><td colspan="5">Sin movimientos registrados todavía.</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </div>
    </div>
  `;
}

function renderResidentResult(record, plate) {
  return `
    <article class="result-card">
      <div class="badge-row">
        <span class="badge badge-success">Vehículo residente</span>
      </div>
      <h2>${escapeHtml(formatPlate(plate))}</h2>
      <p class="muted">Esta placa está asociada a un residente registrado.</p>
      ${record ? renderResidentSummary(record) : ""}
      <div class="action-row">
        <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
        <button class="button" type="button" data-action="open-request">Registrar solicitud</button>
      </div>
      ${renderResidentDetails(record)}
    </article>
  `;
}

function renderResidentSummary(record) {
  return `
    <div class="summary-grid">
      <article class="summary-item">
        <h3>Propietario</h3>
        <p>${escapeHtml(record.fullName)}</p>
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
        <h3>Vehículos asociados</h3>
        ${renderSummaryList(record.vehicles.map((vehicle) => vehicle.plateDisplay), "Sin vehículos")}
      </article>
    </div>
  `;
}

function renderVisitorResult(record, plate) {
  const latestVisit = record.latestVisit;
  const destination = latestVisit
    ? buildApartmentLabel(latestVisit.towerSnapshot, latestVisit.apartmentNumberSnapshot)
    : record.lastApartment?.label || "Sin destino reciente";

  const apartmentPhones = latestVisit?.apartmentPhonesSnapshot?.join(", ") || record.currentPhones.join(", ") || "Sin teléfonos";
  return `
    <article class="result-card">
      <div class="badge-row">
        <span class="badge badge-info">Vehículo visitante</span>
        ${record.openVisit ? '<span class="badge badge-warning">Actualmente dentro</span>' : ""}
      </div>
      <h2>${escapeHtml(formatPlate(plate))}</h2>
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Última visita</h3>
          <p>${escapeHtml(latestVisit ? toFriendlyDate(latestVisit.entryAt || latestVisit.exitAt) : "Sin ingresos aún")}</p>
        </article>
        <article class="summary-item">
          <h3>Persona anunciada</h3>
          <p>${escapeHtml(latestVisit?.visitorName || record.lastKnownName || "Sin nombre reciente")}</p>
        </article>
        <article class="summary-item">
          <h3>Destino</h3>
          <p>${escapeHtml(destination)}</p>
        </article>
        <article class="summary-item">
          <h3>Teléfonos</h3>
          <p>${escapeHtml(apartmentPhones)}</p>
        </article>
      </div>
      <div class="action-row">
        <button class="button" type="button" data-action="register-entry">Registrar ingreso</button>
        <button class="button-ghost" type="button" data-action="register-exit">Registrar salida</button>
        <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
        <button class="button-ghost" type="button" data-action="open-request">Registrar novedad</button>
      </div>
      ${renderVisitorDetails(record)}
    </article>
  `;
}

function renderUnknownResult(plate) {
  const formattedPlate = formatPlate(plate);
  return `
    <article class="result-card">
      <div class="badge-row">
        <span class="badge badge-warning">Placa no registrada</span>
      </div>
      <h2>${escapeHtml(formattedPlate)}</h2>
      <p class="muted">Puedes registrarla como residente o como visitante antes de continuar.</p>
      <div class="action-row">
        <a class="button" href="${ROUTES.REGISTER_RESIDENT}?plate=${encodeURIComponent(formattedPlate)}">Registrar como residente</a>
        <a class="button-ghost" href="${ROUTES.REGISTER_VISITOR}?plate=${encodeURIComponent(formattedPlate)}">Registrar como visitante</a>
      </div>
    </article>
  `;
}

async function openEntryModal(plate, visitorRecord, rerender) {
  openFormModal({
    title: "Registrar ingreso visitante",
    description: "Completa los datos actuales del ingreso. El contexto del apartamento se carga automáticamente.",
    submitText: "Registrar ingreso",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="modal-plate">Placa</label>
          <input id="modal-plate" name="plate" type="text" value="${escapeHtml(formatPlate(plate))}" required />
        </div>
        <div class="field">
          <label for="modal-visitor-name">Nombre del visitante</label>
          <input id="modal-visitor-name" name="visitorName" type="text" value="${escapeHtml(visitorRecord?.lastKnownName || visitorRecord?.latestVisit?.visitorName || "")}" required />
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="modal-tower">Torre</label>
          <select id="modal-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="modal-apartment">Apartamento</label>
          <select id="modal-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
      <section id="modal-apartment-context" class="inline-note">Selecciona torre y apartamento para ver residentes y teléfonos.</section>
    `,
    onOpen: (dialog) => {
      const towerSelect = dialog.querySelector("#modal-tower");
      const apartmentSelect = dialog.querySelector("#modal-apartment");
      const contextBlock = dialog.querySelector("#modal-apartment-context");

      const applyDefaults = () => {
        if (visitorRecord?.lastApartment) {
          towerSelect.value = String(visitorRecord.lastApartment.tower);
          apartmentSelect.value = String(visitorRecord.lastApartment.apartmentNumber);
          updateContext();
        }
      };

      async function updateContext() {
        if (!towerSelect.value || !apartmentSelect.value) {
          contextBlock.textContent = "Selecciona torre y apartamento para ver residentes y teléfonos.";
          return;
        }

        try {
          const context = await getApartmentResidentsContext(towerSelect.value, apartmentSelect.value);
          contextBlock.textContent = `Residentes: ${
            context.residents.map((resident) => resident.fullName).join(", ") || "Sin residentes"
          } · Teléfonos: ${context.phones.join(", ") || "Sin teléfonos"}`;
        } catch (error) {
          contextBlock.textContent = serializeError(error);
        }
      }

      towerSelect.addEventListener("change", updateContext);
      apartmentSelect.addEventListener("change", updateContext);
      applyDefaults();
    },
    onSubmit: async (formData) => {
      await recordVisitorEntry({
        plate: formData.get("plate"),
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });
      showToast("Ingreso registrado correctamente.", "success");
      await rerender();
    },
  });
}

async function openRequestModal(plate, contextType, relatedRecordId = null) {
  openFormModal({
    title: "Registrar solicitud",
    description: "Describe con detalle la corrección o novedad que debe revisar el administrador.",
    submitText: "Enviar solicitud",
    content: `
      <div class="field">
        <label for="request-detail">Detalle</label>
        <textarea id="request-detail" name="message" required></textarea>
      </div>
    `,
    onSubmit: async (formData) => {
      await submitChangeRequest({
        plate,
        message: formData.get("message"),
        contextType,
        relatedRecordId,
      });
      showToast("Solicitud enviada al administrador.", "success");
    },
  });
}

async function initGuardPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.GUARD]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.GUARD,
    activeKey: "guard-home",
    subtitle: "Portería operativa",
  });

  const form = qs("#guard-search-form");
  const resultContainer = qs("#search-result");
  const plateInput = qs("#plate-search");

  plateInput.value = formatPlate(getQueryParam("plate") || "");
  plateInput.addEventListener("input", () => {
    plateInput.value = formatPlate(plateInput.value);
  });

  if (getQueryParam("notice") === "resident-created") {
    showToast("Residente registrado correctamente.", "success");
  }
  if (getQueryParam("notice") === "visitor-created") {
    showToast("Visitante registrado correctamente. Ahora puedes registrar su ingreso.", "success");
  }

  async function runSearch() {
    const plate = plateInput.value;
    if (!isValidPlate(plate)) {
      showToast("Ingresa una placa válida. Carro: AAA-000. Moto: AAA-00A.", "error");
      return;
    }

    const resident = await searchResidentByPlate(plate);
    if (resident) {
      resultContainer.innerHTML = renderResidentResult(resident, plate);
      return;
    }

    const visitor = await searchVisitorByPlate(plate);
    if (visitor) {
      resultContainer.innerHTML = renderVisitorResult(visitor, plate);
      return;
    }

    resultContainer.innerHTML = renderUnknownResult(plate);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Buscando...");

    try {
      await runSearch();
    } catch (error) {
      showToast(serializeError(error, "No fue posible realizar la búsqueda."), "error");
    } finally {
      setButtonLoading(button, false);
    }
  });

  resultContainer.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) {
      return;
    }

    const currentPlate = canonicalizePlate(plateInput.value);

    if (action === "toggle-details") {
      const panel = resultContainer.querySelector(".details-panel");
      panel.hidden = !panel.hidden;
      return;
    }

    try {
      if (action === "register-entry") {
        const visitor = await searchVisitorByPlate(currentPlate);
        await openEntryModal(currentPlate, visitor, runSearch);
      }

      if (action === "register-exit") {
        await recordVisitorExit({ plate: currentPlate });
        showToast("Salida registrada correctamente.", "success");
        await runSearch();
      }

      if (action === "open-request") {
        const resident = await searchResidentByPlate(currentPlate);
        const visitor = resident ? null : await searchVisitorByPlate(currentPlate);
        await openRequestModal(currentPlate, resident ? "resident" : visitor ? "visitor" : "unregistered");
      }
    } catch (error) {
      showToast(serializeError(error), "error");
    }
  });

  if (plateInput.value && isValidPlate(plateInput.value)) {
    await runSearch();
  }
}

initGuardPage();
