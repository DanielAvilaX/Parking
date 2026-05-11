import { escapeHtml, toFriendlyDate, buildApartmentLabel } from "../core/utils.js";

export function renderListBadges(values = [], emptyLabel = "Sin datos") {
  if (!values.length) {
    return `<span class="badge">${escapeHtml(emptyLabel)}</span>`;
  }

  return values.map((value) => `<span class="badge">${escapeHtml(value)}</span>`).join("");
}

export function renderResidentContext(context) {
  const apartmentLabels = context.apartments.map((apartment) => buildApartmentLabel(apartment.tower, apartment.apartmentNumber));
  return `
    <div class="result-card">
      <div class="badge-row">
        <span class="badge badge-success">Vehículo residente</span>
        <span class="badge">Creado: ${escapeHtml(toFriendlyDate(context.createdAt))}</span>
      </div>
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Propietario</h3>
          <p>${escapeHtml(context.fullName)}</p>
        </article>
        <article class="summary-item">
          <h3>Placas</h3>
          <p>${escapeHtml(context.vehicles.map((vehicle) => vehicle.plateDisplay).join(", "))}</p>
        </article>
        <article class="summary-item">
          <h3>Apartamentos</h3>
          <p>${escapeHtml(apartmentLabels.join(" · "))}</p>
        </article>
        <article class="summary-item">
          <h3>Teléfonos</h3>
          <p>${escapeHtml(context.phones.join(", "))}</p>
        </article>
      </div>
    </div>
  `;
}

export function renderVisitorContext(context) {
  const latestVisit = context.latestVisit;
  const destinationLabel = latestVisit
    ? buildApartmentLabel(latestVisit.towerSnapshot, latestVisit.apartmentNumberSnapshot)
    : context.lastApartment
      ? buildApartmentLabel(context.lastApartment.tower, context.lastApartment.apartmentNumber)
      : "Sin destino reciente";

  const residentNames = latestVisit?.residentNamesSnapshot?.length
    ? latestVisit.residentNamesSnapshot.join(", ")
    : context.currentResidents.map((resident) => resident.fullName).join(", ") || "Sin residentes relacionados";

  const phoneNumbers = latestVisit?.apartmentPhonesSnapshot?.length
    ? latestVisit.apartmentPhonesSnapshot.join(", ")
    : context.currentPhones.join(", ") || "Sin teléfonos registrados";

  return `
    <div class="result-card">
      <div class="badge-row">
        <span class="badge badge-info">Vehículo visitante</span>
        ${context.openVisit ? '<span class="badge badge-warning">Vehículo actualmente dentro</span>' : ""}
        <span class="badge">Creado: ${escapeHtml(toFriendlyDate(context.createdAt))}</span>
      </div>
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Última visita</h3>
          <p>${escapeHtml(latestVisit ? toFriendlyDate(latestVisit.entryAt || latestVisit.exitAt) : "Aún sin ingresos")}</p>
        </article>
        <article class="summary-item">
          <h3>Persona anunciada</h3>
          <p>${escapeHtml(latestVisit?.visitorName || context.lastKnownName || "Sin nombre reciente")}</p>
        </article>
        <article class="summary-item">
          <h3>Destino</h3>
          <p>${escapeHtml(destinationLabel)}</p>
        </article>
        <article class="summary-item">
          <h3>Teléfonos del apartamento</h3>
          <p>${escapeHtml(phoneNumbers)}</p>
        </article>
      </div>
      <div class="inline-note">
        Residentes relacionados: ${escapeHtml(residentNames)}
      </div>
    </div>
  `;
}

