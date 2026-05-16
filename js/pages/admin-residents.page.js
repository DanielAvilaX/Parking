import { APP_ROLES } from "../core/constants.js";
import { qs, fillSelect } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  escapeHtml,
  getTowerOptions,
  matchesText,
  normalizePhone,
  serializeError,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { listResidentsDetailed, removeResident, updateResidentBundle } from "../services/resident.service.js";
import {
  buildApartmentAlertText,
  buildTelHref,
  buildWhatsAppHref,
  defineApartmentPrimaryPhone,
  defineApartmentPrimaryPhoneByLocation,
  GENERAL_CONTACT_MESSAGE,
  listApartmentContactOptions,
  logContactAction,
} from "../services/contact.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js?v=20260514-phase1c";
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

function renderApartmentPhones(apartment) {
  if (!apartment.phoneNumbers?.length) {
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
                  ${apartment.missingPrimaryPhone ? '<div class="inline-note inline-note--danger">Este apartamento no tiene número principal definido.</div>' : ""}
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
                  <div class="content-stack">
                    <div>
                      <h4>Números del apartamento</h4>
                      ${renderApartmentPhones(apartment)}
                    </div>
                    <div class="action-row">
                      <button class="button-ghost" type="button" data-action="resident-call" data-apartment-id="${apartment.id}" data-resident-id="${record.id}" data-target-name="${escapeHtml(record.fullName)}">Llamar</button>
                      <button class="button-ghost" type="button" data-action="resident-whatsapp" data-apartment-id="${apartment.id}" data-resident-id="${record.id}" data-target-name="${escapeHtml(record.fullName)}">WhatsApp</button>
                    </div>
                  </div>
                  <div class="table-wrap">
                    <div class="table-scroll">
                      <table class="data-table">
                        <thead>
                          <tr>
                            <th>Placa visitante</th>
                            <th>Nombre</th>
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
                              : '<tr><td colspan="6">Sin visitas registradas para este apartamento.</td></tr>'
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
        title: "Confirmar cambios del residente",
        description: `Vas a modificar datos personales de ${record.fullName}.`,
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
      await reload();
    },
  });
}

async function openApartmentContactModal({
  apartmentId,
  actionType,
  residentId,
  targetName,
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
        contextType: "resident",
        apartmentId,
        residentId,
        targetName,
        phone: selectedPhone.phone,
        isPrimaryPhone: selectedPhone.isPrimary || Boolean(formData.get("setPrimary")),
        messageText: actionType === "whatsapp" ? GENERAL_CONTACT_MESSAGE : null,
      });

      if (actionType === "call") {
        window.location.href = buildTelHref(selectedPhone.phone);
      } else {
        window.open(buildWhatsAppHref(selectedPhone.phone, GENERAL_CONTACT_MESSAGE), "_blank", "noopener");
      }

      if (rerender) {
        await rerender();
      }
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
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
    if (!actionElement || !action) {
      return;
    }

    const residentCard = event.target.closest("[data-resident-id]");
    const record = residentState.find((resident) => resident.id === residentCard?.dataset.residentId);
    if (!record) {
      return;
    }

    try {
      if (action === "toggle-details") {
        const panel = residentCard.querySelector(".details-panel");
        panel.hidden = !panel.hidden;
        return;
      }

      if (action === "edit") {
        openResidentEditModal(record, reload);
        return;
      }

      if (action === "resident-call") {
        await openApartmentContactModal({
          apartmentId: actionElement.dataset.apartmentId,
          actionType: "call",
          residentId: actionElement.dataset.residentId,
          targetName: actionElement.dataset.targetName,
          rerender: reload,
        });
        return;
      }

      if (action === "resident-whatsapp") {
        await openApartmentContactModal({
          apartmentId: actionElement.dataset.apartmentId,
          actionType: "whatsapp",
          residentId: actionElement.dataset.residentId,
          targetName: actionElement.dataset.targetName,
          rerender: reload,
        });
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

        await removeResident(record.id);
        showToast("Residente eliminado correctamente.", "success");
        await reload();
        return;
      }
    } catch (error) {
      showToast(serializeError(error, "No fue posible completar la acción."), "error");
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
