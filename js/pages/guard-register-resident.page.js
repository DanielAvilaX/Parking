import { APP_ROLES } from "../core/constants.js";
import { qs, fillSelect, setButtonLoading } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  formatPlate,
  getApartmentOptions,
  getQueryParam,
  getTowerOptions,
  serializeError,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { createResidentBundle, listResidentsForApartment } from "../services/resident.service.js";
import { mountTopbar } from "../ui/layout.js";
import { showToast } from "../ui/notifications.js";

function createApartmentRow(index) {
  return `
    <div class="repeater__item" data-apartment-row="${index}">
      <div class="repeater__row">
        <div class="field">
          <label>Torre</label>
          <select name="tower" required></select>
        </div>
        <div class="field">
          <label>Apartamento</label>
          <select name="apartment" required></select>
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button class="button-ghost" type="button" data-remove-apartment>Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

function createPhoneRow(index) {
  return `
    <div class="repeater__item" data-phone-row="${index}">
      <div class="repeater__row">
        <div class="field">
          <label>Teléfono</label>
          <input name="phone" type="text" required />
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button class="button-ghost" type="button" data-remove-phone>Eliminar</button>
        </div>
      </div>
    </div>
  `;
}

async function renderExistingResidentOptions(container, tower, apartment) {
  if (!tower || !apartment) {
    container.hidden = true;
    return;
  }

  const residents = await listResidentsForApartment(tower, apartment);
  if (!residents.length) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <strong>Este apartamento ya tiene residentes registrados.</strong>
    <div class="content-stack">
      <label class="badge">
        <input type="radio" name="existingResidentId" value="" checked />
        Crear residente nuevo
      </label>
      ${residents
        .map(
          (resident) => `
            <label class="badge">
              <input type="radio" name="existingResidentId" value="${resident.id}" />
              ${resident.fullName} · Tel: ${resident.phones.join(", ") || "Sin teléfonos"} · Vehículos: ${
                resident.vehicles.join(", ") || "Sin vehículos"
              }
            </label>
          `
        )
        .join("")}
    </div>
  `;
}

async function initResidentRegistrationPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.GUARD, APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: sessionProfile.profile.role,
    activeKey: sessionProfile.profile.role === APP_ROLES.ADMIN ? "residents" : "guard-home",
    subtitle: sessionProfile.profile.role === APP_ROLES.ADMIN ? "Administración de residentes" : "Portería operativa",
  });

  const apartmentsContainer = qs("#resident-apartments");
  const phonesContainer = qs("#resident-phones");
  const form = qs("#resident-form");
  const existingContext = qs("#resident-existing-context");
  const plateInput = qs("#resident-plate");
  let apartmentIndex = 0;
  let phoneIndex = 0;

  function addApartmentRow() {
    apartmentsContainer.insertAdjacentHTML("beforeend", createApartmentRow(apartmentIndex));
    const row = apartmentsContainer.querySelector(`[data-apartment-row="${apartmentIndex}"]`);
    fillSelect(row.querySelector('select[name="tower"]'), getTowerOptions(), "Torre");
    fillSelect(row.querySelector('select[name="apartment"]'), getApartmentOptions(), "Apartamento");
    apartmentIndex += 1;
  }

  function addPhoneRow() {
    phonesContainer.insertAdjacentHTML("beforeend", createPhoneRow(phoneIndex));
    phoneIndex += 1;
  }

  addApartmentRow();
  addPhoneRow();

  plateInput.value = formatPlate(getQueryParam("plate") || "");
  plateInput.addEventListener("input", () => {
    plateInput.value = formatPlate(plateInput.value);
  });

  qs("#add-resident-apartment").addEventListener("click", addApartmentRow);
  qs("#add-resident-phone").addEventListener("click", addPhoneRow);

  apartmentsContainer.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-apartment]")) {
      event.target.closest(".repeater__item")?.remove();
    }
  });

  phonesContainer.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-phone]")) {
      event.target.closest(".repeater__item")?.remove();
    }
  });

  apartmentsContainer.addEventListener("change", async () => {
    const firstRow = apartmentsContainer.querySelector(".repeater__item");
    if (!firstRow) {
      return;
    }

    const tower = firstRow.querySelector('select[name="tower"]').value;
    const apartment = firstRow.querySelector('select[name="apartment"]').value;

    try {
      await renderExistingResidentOptions(existingContext, tower, apartment);
    } catch (error) {
      existingContext.hidden = false;
      existingContext.textContent = serializeError(error);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, "Guardando...");

    try {
      const apartments = [...apartmentsContainer.querySelectorAll(".repeater__item")].map((row) => ({
        tower: row.querySelector('select[name="tower"]').value,
        apartmentNumber: row.querySelector('select[name="apartment"]').value,
      }));

      const phones = [...phonesContainer.querySelectorAll('input[name="phone"]')].map((input) => input.value);
      const existingResidentId = form.querySelector('input[name="existingResidentId"]:checked')?.value || null;

      await createResidentBundle({
        fullName: qs("#resident-name").value,
        plate: plateInput.value,
        phones,
        apartments,
        existingResidentId,
      });

      showToast("Residente guardado correctamente.", "success");
      window.location.href = `/guard/index.html?plate=${encodeURIComponent(formatPlate(plateInput.value))}&notice=resident-created`;
    } catch (error) {
      showToast(serializeError(error, "No fue posible guardar el residente."), "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

initResidentRegistrationPage();

