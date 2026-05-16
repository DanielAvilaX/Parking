import { APP_ROLES, ROUTES } from "../core/constants.js";
import { qs, setButtonLoading } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  buildApartmentLabel,
  canonicalizePlate,
  escapeHtml,
  formatPlate,
  fromDateTimeInputValue,
  getApartmentOptions,
  getQueryParam,
  getTowerOptions,
  isValidPlate,
  normalizePhone,
  serializeError,
  toDateTimeInputValue,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import {
  recordResidentEntry,
  recordResidentExit,
  removeResidentAccessMovement,
  searchResidentByPlate,
  updateResidentAccessMovement,
  updateResidentBundle,
} from "../services/resident.service.js";
import {
  announceVisitor,
  getApartmentResidentsContext,
  markVisitorNoEntry,
  recordVisitorEntry,
  recordVisitorExit,
  removeVisitor,
  removeVisitorLog,
  searchVisitorByPlate,
  updateVisitorBundle,
  updateVisitorHistoryLog,
} from "../services/visitor.service.js";
import {
  buildApartmentAlertText,
  buildTelHref,
  buildVisitorAnnouncementMessage,
  buildWhatsAppHref,
  defineApartmentPrimaryPhone,
  defineApartmentPrimaryPhoneByLocation,
  GENERAL_CONTACT_MESSAGE,
  listApartmentContactOptions,
  logContactAction,
} from "../services/contact.service.js";
import { submitChangeRequest } from "../services/request.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js?v=20260514-phase1c";
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

function parseApartmentListSafe(value = "") {
  try {
    return parseApartmentList(value);
  } catch {
    return [];
  }
}

function buildPrimaryPhoneFieldName(tower, apartmentNumber) {
  return `primaryPhone__${tower}__${apartmentNumber}`;
}

function buildApartmentPhoneCandidates(record, tower, apartmentNumber, typedPhones) {
  const apartment = record.apartments.find(
    (item) => String(item.tower) === String(tower) && String(item.apartmentNumber) === String(apartmentNumber)
  );
  const candidates = new Map();

  (apartment?.phoneNumbers || []).forEach((phone) => {
    candidates.set(normalizePhone(phone.phone), {
      phone: phone.phone,
      isPrimary: phone.isPrimary,
    });
  });

  typedPhones.forEach((phone) => {
    const normalized = normalizePhone(phone);
    if (!normalized || candidates.has(normalized)) {
      return;
    }

    candidates.set(normalized, {
      phone,
      isPrimary: false,
    });
  });

  return [...candidates.values()];
}

function renderResidentPrimaryPhoneSelectors(dialog, record) {
  const container = dialog.querySelector("#resident-primary-phone-config");
  if (!container) {
    return;
  }

  const apartments = parseApartmentListSafe(dialog.querySelector("#resident-apartments-edit")?.value || "");
  const typedPhones = parseLineList(dialog.querySelector("#resident-phones-edit")?.value || "");

  if (!apartments.length) {
    container.innerHTML = '<p class="muted">Agrega al menos un apartamento para poder definir números principales.</p>';
    return;
  }

  container.innerHTML = apartments
    .map((apartmentEntry) => {
      const candidates = buildApartmentPhoneCandidates(
        record,
        apartmentEntry.tower,
        apartmentEntry.apartmentNumber,
        typedPhones
      );
      const fieldName = buildPrimaryPhoneFieldName(apartmentEntry.tower, apartmentEntry.apartmentNumber);
      const currentApartment = record.apartments.find(
        (item) =>
          String(item.tower) === String(apartmentEntry.tower) &&
          String(item.apartmentNumber) === String(apartmentEntry.apartmentNumber)
      );
      const defaultPhone =
        candidates.find((phone) => phone.isPrimary)?.phone ||
        currentApartment?.primaryPhone?.phone ||
        "";

      return `
        <div class="field">
          <label for="${fieldName}">Número principal para Torre ${escapeHtml(
            String(apartmentEntry.tower)
          )} · Apto ${escapeHtml(String(apartmentEntry.apartmentNumber))}</label>
          <select id="${fieldName}" name="${fieldName}">
            <option value="">Sin definir</option>
            ${candidates
              .map(
                (phone) => `
                  <option value="${escapeHtml(phone.phone)}" ${phone.phone === defaultPhone ? "selected" : ""}>
                    ${escapeHtml(phone.phone)}${phone.isPrimary ? " · Actual principal" : ""}
                  </option>
                `
              )
              .join("")}
          </select>
          ${
            candidates.length
              ? '<p class="helper-text">Puedes dejarlo sin definir si aún no quieres asignar un principal.</p>'
              : '<p class="helper-text">No hay teléfonos disponibles todavía para este apartamento.</p>'
          }
        </div>
      `;
    })
    .join("");
}

async function renderVisitorPrimaryPhoneField(dialog) {
  const container = dialog.querySelector("#visitor-primary-phone-config");
  if (!container) {
    return;
  }

  const tower = dialog.querySelector("#visitor-tower-edit")?.value;
  const apartment = dialog.querySelector("#visitor-apartment-edit")?.value;

  if (!tower || !apartment) {
    container.innerHTML = '<p class="muted">Selecciona torre y apartamento para definir el número principal.</p>';
    return;
  }

  try {
    const context = await getApartmentResidentsContext(tower, apartment);
    const options = context.apartmentPhones || [];
    container.innerHTML = `
      <div class="field">
        <label for="visitor-primary-phone">Número principal del apartamento</label>
        <select id="visitor-primary-phone" name="primaryPhone">
          <option value="">Sin definir</option>
          ${options
            .map(
              (phone) => `
                <option value="${escapeHtml(phone.phone)}" ${phone.isPrimary ? "selected" : ""}>
                  ${escapeHtml(phone.phone)}${phone.isPrimary ? " · Actual principal" : ""}
                </option>
              `
            )
            .join("")}
        </select>
        ${
          options.length
            ? '<p class="helper-text">Puedes cambiar el principal del apartamento desde esta edición.</p>'
            : '<p class="helper-text">Este apartamento no tiene teléfonos disponibles todavía.</p>'
        }
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<p class="helper-text">${escapeHtml(serializeError(error, "No fue posible cargar los teléfonos del apartamento."))}</p>`;
  }
}

function renderTowerOptions() {
  return getTowerOptions().map((option) => `<option value="${option}">${option}</option>`).join("");
}

function renderApartmentOptions() {
  return getApartmentOptions().map((option) => `<option value="${option}">${option}</option>`).join("");
}

function renderApartmentPhones(apartment) {
  if (!apartment.phoneNumbers.length) {
    return '<p class="muted">Sin números del apartamento.</p>';
  }

  return `
    <div class="badge-row">
      ${apartment.phoneNumbers
        .map(
          (phone) => `
            <span class="badge ${phone.isPrimary ? "badge-info" : ""}">
              ${escapeHtml(phone.phone)}
              ${phone.isPrimary ? "· Principal" : ""}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderResidentDetails(record, plate) {
  return `
    <div class="details-panel" hidden>
      <div class="content-stack">
        ${
          record.missingPrimaryPhoneInAnyApartment
            ? '<div class="inline-note inline-note--danger">Hay apartamentos con teléfonos registrados pero sin número principal definido.</div>'
            : ""
        }
        ${record.apartments
          .map(
            (apartment) => `
              <article class="glass-card">
                <div class="section-title">
                  <h3>${escapeHtml(apartment.label)}</h3>
                  <span class="helper-text">Visitantes históricos: ${apartment.visitorHistory.length}</span>
                </div>
                ${apartment.missingPrimaryPhone ? '<div class="inline-note inline-note--danger">Este apartamento no tiene número principal definido.</div>' : ""}
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
                <div class="content-stack">
                  <div>
                    <h4>Números del apartamento</h4>
                    ${renderApartmentPhones(apartment)}
                  </div>
                  <div class="action-row">
                    <button class="button-ghost" type="button" data-action="resident-call" data-apartment-id="${apartment.id}" data-resident-id="${record.id}" data-plate="${escapeHtml(plate)}" data-target-name="${escapeHtml(record.fullName)}">Llamar</button>
                    <button class="button-ghost" type="button" data-action="resident-whatsapp" data-apartment-id="${apartment.id}" data-resident-id="${record.id}" data-plate="${escapeHtml(plate)}" data-target-name="${escapeHtml(record.fullName)}">WhatsApp</button>
                  </div>
                </div>
                <div class="table-wrap">
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Visitante</th>
                          <th>Anuncio</th>
                          <th>Ingreso</th>
                          <th>Salida</th>
                          <th>No ingresó</th>
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
                                      <td>${escapeHtml(visit.announced_at ? toFriendlyDate(visit.announced_at) : "No registrado")}</td>
                                      <td>${escapeHtml(visit.entry_at ? toFriendlyDate(visit.entry_at) : "No registrada")}</td>
                                      <td>${escapeHtml(visit.exit_at ? toFriendlyDate(visit.exit_at) : "Pendiente")}</td>
                                      <td>${escapeHtml(visit.no_entry_at ? toFriendlyDate(visit.no_entry_at) : "No aplica")}</td>
                                    </tr>
                                  `
                                )
                                .join("")
                            : '<tr><td colspan="6">Sin historial para este apartamento.</td></tr>'
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            `
          )
          .join("")}
        <article class="glass-card">
          <div class="section-title">
            <h3>Historial de movimientos del residente</h3>
          </div>
          <div class="table-wrap">
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Apartamentos</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>Alerta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    record.accessHistory.length
                      ? record.accessHistory
                          .map(
                            (log) => `
                              <tr data-log-id="${log.id}">
                                <td>${escapeHtml(log.plateDisplay)}</td>
                                <td>${escapeHtml(log.apartmentSnapshots.map((apartment) => apartment.label).join(" · ") || "Sin apartamentos")}</td>
                                <td>${escapeHtml(log.entryAt ? toFriendlyDate(log.entryAt) : "No registrada")}</td>
                                <td>${escapeHtml(log.exitAt ? toFriendlyDate(log.exitAt) : "Pendiente")}</td>
                                <td>${log.entryMissing ? '<span class="badge badge-danger">Sí</span>' : '<span class="badge">No</span>'}</td>
                                <td>
                                  <div class="action-row">
                                    <button class="button-ghost" type="button" data-action="edit-resident-log" data-log-id="${log.id}">Editar</button>
                                    <button class="button-danger" type="button" data-action="delete-resident-log" data-log-id="${log.id}">Eliminar</button>
                                  </div>
                                </td>
                              </tr>
                            `
                          )
                          .join("")
                      : '<tr><td colspan="6">Sin movimientos registrados para este residente.</td></tr>'
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
    <article class="result-card" data-result-type="resident" data-result-id="${record.id}">
      <div class="badge-row">
        <span class="badge badge-success">Vehículo residente</span>
        ${record.openAccessLogs.length ? '<span class="badge badge-warning">Actualmente dentro</span>' : ""}
      </div>
      <h2>${escapeHtml(formatPlate(plate))}</h2>
      <p class="muted">Esta placa está asociada a un residente registrado.</p>
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
      <div class="action-row">
        <button class="button" type="button" data-action="resident-entry">Registrar ingreso</button>
        <button class="button-ghost" type="button" data-action="resident-exit">Registrar salida</button>
        <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
        <button class="button-ghost" type="button" data-action="edit-resident">Editar residente</button>
        <button class="button-ghost" type="button" data-action="open-request">Registrar novedad</button>
      </div>
      ${renderResidentDetails(record, plate)}
    </article>
  `;
}

function renderVisitorDetails(record) {
  return `
    <div class="details-panel" hidden>
      <div class="content-stack">
        ${
          record.missingPrimaryPhone
            ? '<div class="inline-note inline-note--danger">El apartamento destino tiene teléfonos pero no tiene número principal definido.</div>'
            : ""
        }
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
              ${renderSummaryList(
                record.currentApartmentPhones.map((phone) => `${phone.phone}${phone.isPrimary ? " · Principal" : ""}`),
                "Sin teléfonos"
              )}
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
                    <th>Anuncio</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>No ingresó</th>
                    <th>Estado</th>
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
                                <td>${escapeHtml(visit.visitorName || "Sin nombre")}</td>
                                <td>${escapeHtml(buildApartmentLabel(visit.towerSnapshot, visit.apartmentNumberSnapshot))}</td>
                                <td>${escapeHtml(visit.announcedAt ? toFriendlyDate(visit.announcedAt) : "No registrado")}</td>
                                <td>${escapeHtml(visit.entryAt ? toFriendlyDate(visit.entryAt) : "No registrada")}</td>
                                <td>${escapeHtml(visit.exitAt ? toFriendlyDate(visit.exitAt) : "Pendiente")}</td>
                                <td>${escapeHtml(visit.noEntryAt ? toFriendlyDate(visit.noEntryAt) : "No aplica")}</td>
                                <td>${
                                  visit.entryMissing
                                    ? '<span class="badge badge-danger">Salida sin ingreso</span>'
                                    : visit.status === "announced"
                                      ? '<span class="badge badge-warning">Anunciado</span>'
                                      : visit.status === "no-entry"
                                        ? '<span class="badge badge-danger">No ingresó</span>'
                                        : visit.status === "inside"
                                          ? '<span class="badge badge-info">Dentro</span>'
                                          : '<span class="badge badge-success">Cerrado</span>'
                                }</td>
                                <td>
                                  <div class="action-row">
                                    ${
                                      visit.status === "announced"
                                        ? `<button class="button-ghost" type="button" data-action="mark-no-entry" data-log-id="${visit.id}">No ingresó</button>`
                                        : ""
                                    }
                                    <button class="button-ghost" type="button" data-action="edit-visitor-log" data-log-id="${visit.id}">Editar</button>
                                    <button class="button-danger" type="button" data-action="delete-visitor-log" data-log-id="${visit.id}">Eliminar</button>
                                  </div>
                                </td>
                              </tr>
                            `
                          )
                          .join("")
                      : '<tr><td colspan="8">Sin movimientos registrados todavía.</td></tr>'
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

function renderVisitorResult(record, plate) {
  const latestVisit = record.latestVisit;
  const destination = latestVisit
    ? buildApartmentLabel(latestVisit.towerSnapshot, latestVisit.apartmentNumberSnapshot)
    : record.lastApartment?.label || "Sin destino reciente";

  const apartmentPhones = latestVisit?.apartmentPhonesSnapshot?.join(", ") || record.currentPhones.join(", ") || "Sin teléfonos";
  return `
    <article class="result-card" data-result-type="visitor" data-result-id="${record.id}">
      <div class="badge-row">
        <span class="badge badge-info">Vehículo visitante</span>
        ${record.openVisit ? '<span class="badge badge-warning">Actualmente dentro</span>' : ""}
        ${record.pendingAnnouncement ? '<span class="badge badge-warning">Anunciado</span>' : ""}
      </div>
      <h2>${escapeHtml(formatPlate(plate))}</h2>
      ${
        record.missingPrimaryPhone
          ? '<div class="inline-note inline-note--danger">El apartamento destino no tiene número principal definido.</div>'
          : ""
      }
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Última visita</h3>
          <p>${escapeHtml(latestVisit ? toFriendlyDate(latestVisit.entryAt || latestVisit.exitAt || latestVisit.announcedAt || latestVisit.noEntryAt) : "Sin ingresos aún")}</p>
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
        <button class="button-ghost" type="button" data-action="announce-visitor">Anunciar</button>
        <button class="button" type="button" data-action="register-entry">Registrar ingreso</button>
        <button class="button-ghost" type="button" data-action="register-exit">Registrar salida</button>
        <button class="button-ghost" type="button" data-action="visitor-call">Llamar</button>
        <button class="button-ghost" type="button" data-action="visitor-whatsapp">WhatsApp</button>
        ${record.pendingAnnouncement ? '<button class="button-ghost" type="button" data-action="mark-no-entry">No ingresó</button>' : ""}
        <button class="button-ghost" type="button" data-action="toggle-details">Más información</button>
        <button class="button-ghost" type="button" data-action="edit-visitor">Editar visitante</button>
        <button class="button-danger" type="button" data-action="delete-visitor">Eliminar visitante</button>
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

async function openApartmentContactModal({
  apartmentId,
  actionType,
  contextType,
  residentId = null,
  visitorVehicleId = null,
  plate = null,
  targetName = null,
  messageText = GENERAL_CONTACT_MESSAGE,
  rerender,
}) {
  const contactContext = await listApartmentContactOptions(apartmentId);
  if (!contactContext.apartmentPhones.length) {
    throw new Error("Este apartamento no tiene números disponibles para contacto.");
  }

  const warningText = buildApartmentAlertText(contactContext);
  openFormModal({
    title: actionType === "call" ? "Llamar al apartamento" : "Abrir WhatsApp",
    description: contactContext.apartment?.label || "Selecciona el número a utilizar.",
    submitText: actionType === "call" ? "Llamar" : "Abrir WhatsApp",
    content: `
      <div class="content-stack">
        ${warningText ? `<div class="inline-note inline-note--danger">${escapeHtml(warningText)}</div>` : ""}
        <div class="choice-stack">
          ${contactContext.apartmentPhones
            .map(
              (phone, index) => `
                <label class="option-card">
                  <input type="radio" name="phoneId" value="${phone.id}" ${phone.isPrimary || (!contactContext.primaryPhone && index === 0) ? "checked" : ""} />
                  <span>${escapeHtml(phone.phone)}</span>
                  ${phone.isPrimary ? '<span class="badge badge-info">Principal</span>' : ""}
                </label>
              `
            )
            .join("")}
        </div>
        <label class="option-card">
          <input type="checkbox" name="setPrimary" />
          <span>Definir el número seleccionado como principal</span>
        </label>
      </div>
    `,
    onSubmit: async (formData) => {
      const phoneId = formData.get("phoneId");
      const selectedPhone = contactContext.apartmentPhones.find((phone) => phone.id === phoneId);
      if (!selectedPhone) {
        throw new Error("Selecciona un número para continuar.");
      }

      if (formData.get("setPrimary")) {
        await defineApartmentPrimaryPhone(apartmentId, selectedPhone.id);
      }

      await logContactAction({
        actionType,
        contextType,
        apartmentId,
        residentId,
        visitorVehicleId,
        plate,
        targetName,
        phone: selectedPhone.phone,
        isPrimaryPhone: selectedPhone.isPrimary || Boolean(formData.get("setPrimary")),
        messageText: actionType === "whatsapp" ? messageText : null,
      });

      if (actionType === "call") {
        window.location.href = buildTelHref(selectedPhone.phone);
      } else {
        window.open(buildWhatsAppHref(selectedPhone.phone, messageText), "_blank", "noopener");
      }

      if (rerender) {
        await rerender();
      }
    },
  });
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
          } · Teléfonos: ${context.phones.join(", ") || "Sin teléfonos"}${context.missingPrimaryPhone ? " · Sin principal" : ""}`;
        } catch (error) {
          contextBlock.textContent = serializeError(error);
        }
      }

      towerSelect.addEventListener("change", updateContext);
      apartmentSelect.addEventListener("change", updateContext);
      applyDefaults();
    },
    onSubmit: async (formData) => {
      const result = await recordVisitorEntry({
        plate: formData.get("plate"),
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });
      showToast(
        result.hadOpenLog
          ? "Ingreso registrado. Ya existía un ingreso abierto para esta placa."
          : "Ingreso registrado correctamente.",
        result.hadOpenLog ? "info" : "success"
      );
      await rerender();
    },
  });
}

async function openAnnouncementModal(plate, visitorRecord, rerender) {
  openFormModal({
    title: "Anunciar visitante",
    description: "Selecciona el destino del visitante. Desde aquí también puedes llamar o escribir al apartamento.",
    submitText: "Confirmar anuncio",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="announce-plate">Placa</label>
          <input id="announce-plate" name="plate" type="text" value="${escapeHtml(formatPlate(plate))}" required />
        </div>
        <div class="field">
          <label for="announce-visitor-name">Nombre del visitante</label>
          <input id="announce-visitor-name" name="visitorName" type="text" value="${escapeHtml(visitorRecord?.lastKnownName || visitorRecord?.latestVisit?.visitorName || "")}" required />
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="announce-tower">Torre</label>
          <select id="announce-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="announce-apartment">Apartamento</label>
          <select id="announce-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
      <div class="content-stack">
        <section id="announce-apartment-context" class="inline-note">Selecciona torre y apartamento para ver residentes y teléfonos.</section>
        <div id="announce-phone-options" class="choice-stack"></div>
        <div class="action-row">
          <button class="button-ghost" type="button" id="announce-call-button">Llamar</button>
          <button class="button-ghost" type="button" id="announce-whatsapp-button">WhatsApp</button>
        </div>
        <label class="option-card">
          <input type="checkbox" id="announce-set-primary" />
          <span>Definir el número seleccionado como principal</span>
        </label>
      </div>
    `,
    onOpen: (dialog) => {
      const towerSelect = dialog.querySelector("#announce-tower");
      const apartmentSelect = dialog.querySelector("#announce-apartment");
      const contextBlock = dialog.querySelector("#announce-apartment-context");
      const phoneOptions = dialog.querySelector("#announce-phone-options");
      const callButton = dialog.querySelector("#announce-call-button");
      const whatsappButton = dialog.querySelector("#announce-whatsapp-button");
      const setPrimaryCheckbox = dialog.querySelector("#announce-set-primary");
      let currentContext = null;

      const applyDefaults = () => {
        if (visitorRecord?.lastApartment) {
          towerSelect.value = String(visitorRecord.lastApartment.tower);
          apartmentSelect.value = String(visitorRecord.lastApartment.apartmentNumber);
          updateContext();
        }
      };

      const getSelectedPhone = () => {
        const selectedId = dialog.querySelector('input[name="announcement-phone"]:checked')?.value;
        return currentContext?.apartmentPhones.find((phone) => phone.id === selectedId) || null;
      };

      const handleContact = async (actionType) => {
        if (!currentContext?.apartment) {
          showToast("Selecciona primero una torre y un apartamento.", "error");
          return;
        }

        const selectedPhone = getSelectedPhone();
        if (!selectedPhone) {
          showToast("Selecciona un número para continuar.", "error");
          return;
        }

        if (setPrimaryCheckbox.checked) {
          currentContext = await defineApartmentPrimaryPhone(currentContext.apartment.id, selectedPhone.id);
        }

        const messageText = buildVisitorAnnouncementMessage({
          plate: dialog.querySelector("#announce-plate").value,
          tower: towerSelect.value,
          apartmentNumber: apartmentSelect.value,
        });

        await logContactAction({
          actionType,
          contextType: "visitor",
          apartmentId: currentContext.apartment.id,
          visitorVehicleId: visitorRecord?.id || null,
          plate: dialog.querySelector("#announce-plate").value,
          targetName: dialog.querySelector("#announce-visitor-name").value,
          phone: selectedPhone.phone,
          isPrimaryPhone: selectedPhone.isPrimary || setPrimaryCheckbox.checked,
          messageText: actionType === "whatsapp" ? messageText : null,
        });

        if (actionType === "call") {
          window.location.href = buildTelHref(selectedPhone.phone);
        } else {
          window.open(buildWhatsAppHref(selectedPhone.phone, messageText), "_blank", "noopener");
        }
      };

      async function updateContext() {
        if (!towerSelect.value || !apartmentSelect.value) {
          contextBlock.textContent = "Selecciona torre y apartamento para ver residentes y teléfonos.";
          phoneOptions.innerHTML = "";
          currentContext = null;
          return;
        }

        try {
          currentContext = await getApartmentResidentsContext(towerSelect.value, apartmentSelect.value);
          const warning = currentContext.missingPrimaryPhone
            ? `${buildApartmentAlertText(currentContext)} Puedes escoger un número y definirlo como principal.`
            : "";

          contextBlock.textContent = `Residentes: ${
            currentContext.residents.map((resident) => resident.fullName).join(", ") || "Sin residentes"
          } · Teléfonos: ${currentContext.phones.join(", ") || "Sin teléfonos"}${warning ? ` · ${warning}` : ""}`;

          phoneOptions.innerHTML = currentContext.apartmentPhones.length
            ? currentContext.apartmentPhones
                .map(
                  (phone, index) => `
                    <label class="option-card">
                      <input type="radio" name="announcement-phone" value="${phone.id}" ${
                        phone.isPrimary || (!currentContext.primaryPhone && index === 0) ? "checked" : ""
                      } />
                      <span>${escapeHtml(phone.phone)}</span>
                      ${phone.isPrimary ? '<span class="badge badge-info">Principal</span>' : ""}
                    </label>
                  `
                )
                .join("")
            : '<p class="muted">No hay números disponibles para este apartamento.</p>';
        } catch (error) {
          contextBlock.textContent = serializeError(error);
          phoneOptions.innerHTML = "";
          currentContext = null;
        }
      }

      towerSelect.addEventListener("change", updateContext);
      apartmentSelect.addEventListener("change", updateContext);
      callButton.addEventListener("click", () => handleContact("call"));
      whatsappButton.addEventListener("click", () => handleContact("whatsapp"));
      applyDefaults();
    },
    onSubmit: async (formData) => {
      await announceVisitor({
        plate: formData.get("plate"),
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });
      showToast("Visitante anunciado correctamente.", "success");
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

function openResidentEditModal(record, rerender) {
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
      <div id="resident-primary-phone-config" class="content-stack"></div>
    `,
    onOpen: (dialog) => {
      renderResidentPrimaryPhoneSelectors(dialog, record);
      dialog
        .querySelector("#resident-phones-edit")
        ?.addEventListener("input", () => renderResidentPrimaryPhoneSelectors(dialog, record));
      dialog
        .querySelector("#resident-apartments-edit")
        ?.addEventListener("input", () => renderResidentPrimaryPhoneSelectors(dialog, record));
    },
    onSubmit: async (formData) => {
      const confirmed = await confirmModal({
        title: "Confirmar cambio de datos personales",
        description: "Se actualizarán datos personales y maestros del residente.",
        confirmText: "Guardar cambios",
      });

      if (!confirmed) {
        return false;
      }

      await updateResidentBundle({
        residentId: record.id,
        fullName: formData.get("fullName"),
        phones: parseLineList(formData.get("phones")),
        vehicles: parseLineList(formData.get("vehicles")).map((plate) => ({ plate })),
        apartments: parseApartmentList(formData.get("apartments")),
      });

      const apartments = parseApartmentList(formData.get("apartments"));
      const primaryPhoneEntries = apartments
        .map((apartment) => ({
          tower: apartment.tower,
          apartmentNumber: apartment.apartmentNumber,
          phone: formData.get(buildPrimaryPhoneFieldName(apartment.tower, apartment.apartmentNumber)),
        }))
        .filter((entry) => entry.phone);

      for (const entry of primaryPhoneEntries) {
        await defineApartmentPrimaryPhoneByLocation(entry);
      }

      showToast("Residente actualizado correctamente.", "success");
      await rerender();
    },
  });
}

function openVisitorEditModal(record, rerender) {
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
      <div id="visitor-primary-phone-config" class="content-stack"></div>
    `,
    onOpen: async (dialog) => {
      if (record.lastApartment) {
        dialog.querySelector("#visitor-tower-edit").value = String(record.lastApartment.tower);
        dialog.querySelector("#visitor-apartment-edit").value = record.lastApartment.apartmentNumber;
      }
      await renderVisitorPrimaryPhoneField(dialog);
      dialog
        .querySelector("#visitor-tower-edit")
        ?.addEventListener("change", () => void renderVisitorPrimaryPhoneField(dialog));
      dialog
        .querySelector("#visitor-apartment-edit")
        ?.addEventListener("change", () => void renderVisitorPrimaryPhoneField(dialog));
    },
    onSubmit: async (formData) => {
      const confirmed = await confirmModal({
        title: "Confirmar cambio de datos personales",
        description: "Se actualizarán los datos personales del visitante.",
        confirmText: "Guardar cambios",
      });

      if (!confirmed) {
        return false;
      }

      await updateVisitorBundle({
        visitorId: record.id,
        plate: formatPlate(formData.get("plate")),
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });

      const selectedPrimaryPhone = formData.get("primaryPhone");
      if (selectedPrimaryPhone) {
        await defineApartmentPrimaryPhoneByLocation({
          tower: formData.get("tower"),
          apartmentNumber: formData.get("apartment"),
          phone: selectedPrimaryPhone,
        });
      }

      showToast("Visitante actualizado correctamente.", "success");
      await rerender();
    },
  });
}

function openResidentMovementEditModal(log, rerender) {
  openFormModal({
    title: "Editar movimiento residente",
    description: `Placa ${log.plateDisplay}`,
    submitText: "Guardar movimiento",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="resident-log-entry">Ingreso</label>
          <input id="resident-log-entry" name="entryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.entryAt))}" />
        </div>
        <div class="field">
          <label for="resident-log-exit">Salida</label>
          <input id="resident-log-exit" name="exitAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.exitAt))}" />
        </div>
      </div>
    `,
    onSubmit: async (formData) => {
      await updateResidentAccessMovement({
        logId: log.id,
        entryAt: fromDateTimeInputValue(formData.get("entryAt")),
        exitAt: fromDateTimeInputValue(formData.get("exitAt")),
      });
      showToast("Movimiento residente actualizado.", "success");
      await rerender();
    },
  });
}

function openVisitorMovementEditModal(log, rerender) {
  openFormModal({
    title: "Editar movimiento visitante",
    description: "Ajusta anuncio, ingreso, salida y estado de no ingreso según corresponda.",
    submitText: "Guardar movimiento",
    content: `
      <div class="field">
        <label for="history-visitor-name">Nombre del visitante</label>
        <input id="history-visitor-name" name="visitorName" type="text" value="${escapeHtml(log.visitorName || "")}" required />
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
          <label for="history-announced-at">Anuncio</label>
          <input id="history-announced-at" name="announcedAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.announcedAt))}" />
        </div>
        <div class="field">
          <label for="history-entry-at">Ingreso</label>
          <input id="history-entry-at" name="entryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.entryAt))}" />
        </div>
      </div>
      <div class="field-grid">
        <div class="field">
          <label for="history-exit-at">Salida</label>
          <input id="history-exit-at" name="exitAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.exitAt))}" />
        </div>
        <div class="field">
          <label for="history-no-entry-at">No ingresó</label>
          <input id="history-no-entry-at" name="noEntryAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(log.noEntryAt))}" />
        </div>
      </div>
    `,
    onOpen: (dialog) => {
      dialog.querySelector("#history-tower").value = String(log.towerSnapshot);
      dialog.querySelector("#history-apartment").value = log.apartmentNumberSnapshot;
    },
    onSubmit: async (formData) => {
      await updateVisitorHistoryLog({
        logId: log.id,
        visitorName: formData.get("visitorName"),
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
        announcedAt: fromDateTimeInputValue(formData.get("announcedAt")),
        entryAt: fromDateTimeInputValue(formData.get("entryAt")),
        exitAt: fromDateTimeInputValue(formData.get("exitAt")),
        noEntryAt: fromDateTimeInputValue(formData.get("noEntryAt")),
      });
      showToast("Movimiento visitante actualizado.", "success");
      await rerender();
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
    showToast("Visitante registrado correctamente. Ahora puedes registrarlo o anunciarlo.", "success");
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
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
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
      const resident = await searchResidentByPlate(currentPlate);
      const visitor = resident ? null : await searchVisitorByPlate(currentPlate);

      if (action === "resident-entry" && resident) {
        const result = await recordResidentEntry({ plate: currentPlate });
        showToast(
          result.hadOpenLog
            ? "Ingreso residente registrado. Ya existía un ingreso abierto para esta placa."
            : "Ingreso residente registrado correctamente.",
          result.hadOpenLog ? "info" : "success"
        );
        await runSearch();
        return;
      }

      if (action === "resident-exit" && resident) {
        const result = await recordResidentExit({ plate: currentPlate });
        showToast(
          result.entryMissing
            ? "Salida residente registrada sin ingreso previo."
            : "Salida residente registrada correctamente.",
          result.entryMissing ? "info" : "success"
        );
        await runSearch();
        return;
      }

      if (action === "edit-resident" && resident) {
        openResidentEditModal(resident, runSearch);
        return;
      }

      if (action === "resident-call" && resident) {
        await openApartmentContactModal({
          apartmentId: actionElement.dataset.apartmentId,
          actionType: "call",
          contextType: "resident",
          residentId: actionElement.dataset.residentId,
          plate: actionElement.dataset.plate,
          targetName: actionElement.dataset.targetName,
          messageText: GENERAL_CONTACT_MESSAGE,
          rerender: runSearch,
        });
        return;
      }

      if (action === "resident-whatsapp" && resident) {
        await openApartmentContactModal({
          apartmentId: actionElement.dataset.apartmentId,
          actionType: "whatsapp",
          contextType: "resident",
          residentId: actionElement.dataset.residentId,
          plate: actionElement.dataset.plate,
          targetName: actionElement.dataset.targetName,
          messageText: GENERAL_CONTACT_MESSAGE,
          rerender: runSearch,
        });
        return;
      }

      if (action === "edit-resident-log" && resident) {
        const log = resident.accessHistory.find((item) => item.id === actionElement.dataset.logId);
        if (log) {
          openResidentMovementEditModal(log, runSearch);
        }
        return;
      }

      if (action === "delete-resident-log" && resident) {
        const confirmed = await confirmModal({
          title: "Eliminar movimiento residente",
          description: "Se eliminará el movimiento seleccionado.",
          confirmText: "Eliminar movimiento",
          danger: true,
        });

        if (!confirmed) {
          return;
        }

        await removeResidentAccessMovement(actionElement.dataset.logId);
        showToast("Movimiento residente eliminado.", "success");
        await runSearch();
        return;
      }

      if (action === "announce-visitor" && visitor) {
        await openAnnouncementModal(currentPlate, visitor, runSearch);
        return;
      }

      if (action === "register-entry" && visitor) {
        await openEntryModal(currentPlate, visitor, runSearch);
        return;
      }

      if (action === "register-exit" && visitor) {
        const result = await recordVisitorExit({ plate: currentPlate });
        showToast(
          result.entryMissing
            ? "Salida registrada sin ingreso previo."
            : "Salida registrada correctamente.",
          result.entryMissing ? "info" : "success"
        );
        await runSearch();
        return;
      }

      if (action === "visitor-call" && visitor && visitor.lastApartment) {
        await openApartmentContactModal({
          apartmentId: visitor.lastApartment.id,
          actionType: "call",
          contextType: "visitor",
          visitorVehicleId: visitor.id,
          plate: currentPlate,
          targetName: visitor.lastKnownName,
          messageText: buildVisitorAnnouncementMessage({
            plate: currentPlate,
            tower: visitor.lastApartment.tower,
            apartmentNumber: visitor.lastApartment.apartmentNumber,
          }),
          rerender: runSearch,
        });
        return;
      }

      if (action === "visitor-whatsapp" && visitor && visitor.lastApartment) {
        await openApartmentContactModal({
          apartmentId: visitor.lastApartment.id,
          actionType: "whatsapp",
          contextType: "visitor",
          visitorVehicleId: visitor.id,
          plate: currentPlate,
          targetName: visitor.lastKnownName,
          messageText: buildVisitorAnnouncementMessage({
            plate: currentPlate,
            tower: visitor.lastApartment.tower,
            apartmentNumber: visitor.lastApartment.apartmentNumber,
          }),
          rerender: runSearch,
        });
        return;
      }

      if (action === "mark-no-entry" && visitor) {
        const targetLogId = actionElement.dataset.logId || visitor.pendingAnnouncement?.id;
        if (!targetLogId) {
          throw new Error("No existe un anuncio pendiente para marcar como no ingresó.");
        }

        const confirmed = await confirmModal({
          title: "Marcar como no ingresó",
          description: "El visitante quedará registrado como anunciado pero no ingresó.",
          confirmText: "Marcar no ingreso",
        });

        if (!confirmed) {
          return;
        }

        await markVisitorNoEntry({ logId: targetLogId });
        showToast("El visitante fue marcado como no ingresó.", "success");
        await runSearch();
        return;
      }

      if (action === "edit-visitor" && visitor) {
        openVisitorEditModal(visitor, runSearch);
        return;
      }

      if (action === "delete-visitor" && visitor) {
        const confirmed = await confirmModal({
          title: "Eliminar visitante",
          description: "Se eliminará el visitante y su historial asociado según la configuración actual de la base de datos.",
          confirmText: "Eliminar visitante",
          danger: true,
        });

        if (!confirmed) {
          return;
        }

        await removeVisitor(visitor.id);
        showToast("Visitante eliminado correctamente.", "success");
        await runSearch();
        return;
      }

      if (action === "edit-visitor-log" && visitor) {
        const log = visitor.history.find((item) => item.id === actionElement.dataset.logId);
        if (log) {
          openVisitorMovementEditModal(log, runSearch);
        }
        return;
      }

      if (action === "delete-visitor-log" && visitor) {
        const confirmed = await confirmModal({
          title: "Eliminar movimiento visitante",
          description: "Se eliminará el movimiento histórico seleccionado.",
          confirmText: "Eliminar movimiento",
          danger: true,
        });

        if (!confirmed) {
          return;
        }

        await removeVisitorLog(actionElement.dataset.logId);
        showToast("Movimiento visitante eliminado.", "success");
        await runSearch();
        return;
      }

      if (action === "open-request") {
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
