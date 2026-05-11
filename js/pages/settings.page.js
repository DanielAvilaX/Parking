import { APP_ROLES } from "../core/constants.js";
import { qs, setButtonLoading } from "../core/dom.js";
import { getStoredThemePreference, initTheme, saveThemePreference } from "../core/theme.js";
import { escapeHtml, serializeError } from "../core/utils.js";
import { getSessionProfile, requireRole, updateOwnCredentials } from "../services/auth.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { showToast } from "../ui/notifications.js";

function renderAdminAccountForm(profile) {
  return `
    <form id="account-form" class="page-form">
      <div class="field">
        <label for="account-email">Correo actual</label>
        <input id="account-email" name="email" type="email" value="${escapeHtml(profile.email)}" required />
      </div>
      <div class="field">
        <label for="account-password">Nueva contraseña</label>
        <input id="account-password" name="password" type="password" placeholder="Déjala vacía si no deseas cambiarla" />
      </div>
      <button class="button" type="submit">Actualizar credenciales</button>
    </form>
  `;
}

function renderGuardAccountCopy(profile) {
  return `
    <p class="muted">Sesión actual: ${escapeHtml(profile.email)}</p>
    <p class="inline-note">La sesión del guarda se conserva entre aperturas del navegador, tal como definiste. Desde esta pantalla puedes cambiar el tema, pero la modificación de credenciales queda reservada al administrador.</p>
  `;
}

async function initSettingsPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN, APP_ROLES.GUARD]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: sessionProfile.profile.role,
    activeKey: "settings",
    subtitle: sessionProfile.profile.role === APP_ROLES.ADMIN ? "Panel administrativo" : "Portería operativa",
  });

  const themeSelect = qs("#theme-preference");
  themeSelect.value = getStoredThemePreference();
  qs("#theme-form").addEventListener("submit", (event) => {
    event.preventDefault();
    saveThemePreference(themeSelect.value);
    showToast("Preferencia de tema guardada.", "success");
  });

  const accountContainer = qs("#account-settings-content");
  accountContainer.innerHTML =
    sessionProfile.profile.role === APP_ROLES.ADMIN
      ? renderAdminAccountForm(sessionProfile.profile)
      : renderGuardAccountCopy(sessionProfile.profile);

  if (sessionProfile.profile.role === APP_ROLES.ADMIN) {
    const accountForm = qs("#account-form");
    accountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = accountForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true, "Actualizando...");

      try {
        const current = await getSessionProfile();
        const formData = new FormData(accountForm);
        await updateOwnCredentials({
          email: formData.get("email") || current.profile.email,
          password: formData.get("password"),
        });
        showToast("Credenciales actualizadas. Revisa tu correo si Supabase solicita confirmación.", "success");
      } catch (error) {
        showToast(serializeError(error), "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }
}

initSettingsPage();
