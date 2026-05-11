import { initTheme } from "../core/theme.js";
import { qs, setButtonLoading } from "../core/dom.js";
import { serializeError } from "../core/utils.js";
import {
  redirectAuthenticatedUser,
  redirectToRoleHome,
  sendPasswordRecovery,
  signIn,
  updateRecoveredPassword,
} from "../services/auth.service.js";
import { showToast } from "../ui/notifications.js";

function openCurtain() {
  qs("#auth-curtain")?.classList.add("is-open");
}

function isRecoveryFlow() {
  return window.location.hash.includes("type=recovery");
}

async function initLoginPage() {
  initTheme();
  if (await redirectAuthenticatedUser()) {
    return;
  }

  const toggleButton = qs("#toggle-auth-panel");
  const loginForm = qs("#login-form");
  const resetRequestForm = qs("#reset-request-form");
  const passwordUpdateForm = qs("#password-update-form");
  const resetPanel = qs("#recovery-panel");
  const passwordPanel = qs("#password-update-panel");

  toggleButton?.addEventListener("click", openCurtain);
  qs("#open-reset-panel")?.addEventListener("click", () => {
    openCurtain();
    resetPanel.hidden = false;
  });

  if (isRecoveryFlow()) {
    openCurtain();
    passwordPanel.hidden = false;
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Ingresando...");

    try {
      const formData = new FormData(loginForm);
      const { profile } = await signIn(formData.get("email"), formData.get("password"));
      showToast("Sesión iniciada correctamente.", "success");
      redirectToRoleHome(profile.role);
    } catch (error) {
      showToast(serializeError(error, "No fue posible iniciar sesión."), "error");
    } finally {
      setButtonLoading(button, false);
    }
  });

  resetRequestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = resetRequestForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Enviando...");

    try {
      const formData = new FormData(resetRequestForm);
      await sendPasswordRecovery(formData.get("email"));
      showToast("Revisa tu correo para completar la recuperación.", "success");
    } catch (error) {
      showToast(serializeError(error, "No fue posible enviar el enlace."), "error");
    } finally {
      setButtonLoading(button, false);
    }
  });

  passwordUpdateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = passwordUpdateForm.querySelector('button[type="submit"]');
    setButtonLoading(button, true, "Actualizando...");

    try {
      const formData = new FormData(passwordUpdateForm);
      await updateRecoveredPassword(formData.get("password"));
      showToast("Contraseña actualizada. Ahora puedes ingresar.", "success");
      window.location.hash = "";
      passwordPanel.hidden = true;
    } catch (error) {
      showToast(serializeError(error, "No fue posible actualizar la contraseña."), "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
}

initLoginPage();

