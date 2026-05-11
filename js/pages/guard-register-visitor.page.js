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
import { registerVisitorVehicle, getApartmentResidentsContext } from "../services/visitor.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { showToast } from "../ui/notifications.js";

async function initVisitorRegistrationPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.GUARD, APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: sessionProfile.profile.role,
    activeKey: sessionProfile.profile.role === APP_ROLES.ADMIN ? "visitors" : "guard-home",
    subtitle: sessionProfile.profile.role === APP_ROLES.ADMIN ? "Administración de visitantes" : "Portería operativa",
  });

  const towerSelect = qs("#visitor-tower");
  const apartmentSelect = qs("#visitor-apartment");
  const plateInput = qs("#visitor-plate");
  const visitorForm = qs("#visitor-form");
  const contextContainer = qs("#visitor-apartment-context");

  fillSelect(towerSelect, getTowerOptions(), "Torre");
  fillSelect(apartmentSelect, getApartmentOptions(), "Apartamento");

  plateInput.value = formatPlate(getQueryParam("plate") || "");
  plateInput.addEventListener("input", () => {
    plateInput.value = formatPlate(plateInput.value);
  });

  async function updateApartmentContext() {
    if (!towerSelect.value || !apartmentSelect.value) {
      contextContainer.innerHTML = `
        <div class="page-heading">
          <h1>Contexto del apartamento</h1>
          <p>Selecciona primero torre y apartamento para ver residentes y teléfonos relacionados.</p>
        </div>
      `;
      return;
    }

    try {
      const context = await getApartmentResidentsContext(towerSelect.value, apartmentSelect.value);
      contextContainer.innerHTML = `
        <div class="page-heading">
          <h1>${context.apartment ? `Torre ${context.apartment.tower} · Apto ${context.apartment.apartment_number}` : "Apartamento"}</h1>
          <p>Residentes: ${context.residents.map((resident) => resident.fullName).join(", ") || "Sin residentes registrados"}.</p>
        </div>
        <p class="muted">Teléfonos: ${context.phones.join(", ") || "Sin teléfonos registrados"}.</p>
      `;
    } catch (error) {
      contextContainer.innerHTML = `<p class="muted">${serializeError(error)}</p>`;
    }
  }

  towerSelect.addEventListener("change", updateApartmentContext);
  apartmentSelect.addEventListener("change", updateApartmentContext);

  visitorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = visitorForm.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, "Guardando...");

    try {
      await registerVisitorVehicle({
        plate: plateInput.value,
        visitorName: qs("#visitor-name").value,
        tower: towerSelect.value,
        apartmentNumber: apartmentSelect.value,
      });
      showToast("Visitante guardado correctamente.", "success");
      window.location.href = `/guard/index.html?plate=${encodeURIComponent(formatPlate(plateInput.value))}&notice=visitor-created`;
    } catch (error) {
      showToast(serializeError(error, "No fue posible guardar el visitante."), "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

initVisitorRegistrationPage();
