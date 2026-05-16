import { APP_ROLES } from "../core/constants.js";
import { qs, setButtonLoading } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import { escapeHtml, serializeError, toFriendlyDate } from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { changeGuardPassword, createGuard, listGuards, removeGuard, updateGuard } from "../services/guard-admin.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js?v=20260514-phase1c";
import { showToast } from "../ui/notifications.js";

let guardState = [];

function renderGuardCard(guard) {
  return `
    <article class="panel record-card">
      <div class="record-card__header">
        <div class="record-card__title">
          <h2>${escapeHtml(guard.email)}</h2>
          <p>Creado: ${escapeHtml(toFriendlyDate(guard.created_at))}</p>
        </div>
        <div class="badge-row">
          <span class="badge ${guard.is_active ? "badge-success" : "badge-danger"}">${guard.is_active ? "Activo" : "Inactivo"}</span>
        </div>
      </div>
      <div class="summary-grid">
        <article class="summary-item">
          <h3>Último acceso</h3>
          <p>${escapeHtml(guard.last_sign_in_at ? toFriendlyDate(guard.last_sign_in_at) : "Sin acceso aún")}</p>
        </article>
        <article class="summary-item">
          <h3>Rol</h3>
          <p>Guarda</p>
        </article>
      </div>
      <div class="action-row">
        <button class="button" type="button" data-action="edit" data-guard-id="${guard.id}">Editar</button>
        <button class="button-ghost" type="button" data-action="reset-password" data-guard-id="${guard.id}">Restablecer contraseña</button>
        <button class="button-danger" type="button" data-action="delete" data-guard-id="${guard.id}">Eliminar</button>
      </div>
    </article>
  `;
}

function renderGuardList() {
  qs("#guard-list").innerHTML = guardState.length
    ? guardState.map(renderGuardCard).join("")
    : '<div class="panel empty-state">No hay guardas registrados todavía.</div>';
}

function openGuardEditModal(guard, reload) {
  openFormModal({
    title: "Editar guarda",
    description: "Puedes cambiar el correo y activar o desactivar la cuenta.",
    submitText: "Guardar cambios",
    content: `
      <div class="field">
        <label for="guard-email-edit">Correo</label>
        <input id="guard-email-edit" name="email" type="email" value="${escapeHtml(guard.email)}" required />
      </div>
      <label class="badge">
        <input id="guard-active-edit" name="isActive" type="checkbox" ${guard.is_active ? "checked" : ""} />
        Cuenta activa
      </label>
    `,
    onSubmit: async (formData) => {
      await updateGuard(guard.id, formData.get("email"), formData.get("isActive") === "on");
      showToast("Cuenta de guarda actualizada.", "success");
      await reload();
    },
  });
}

function openPasswordResetModal(guard, reload) {
  openFormModal({
    title: "Restablecer contraseña",
    description: `Nueva contraseña para ${guard.email}.`,
    submitText: "Guardar contraseña",
    content: `
      <div class="field">
        <label for="guard-password-reset">Nueva contraseña</label>
        <input id="guard-password-reset" name="password" type="password" required />
      </div>
    `,
    onSubmit: async (formData) => {
      await changeGuardPassword(guard.id, formData.get("password"));
      showToast("Contraseña restablecida correctamente.", "success");
      await reload();
    },
  });
}

async function initAdminGuardsPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.ADMIN,
    activeKey: "guards",
    subtitle: "Panel administrativo",
  });

  async function reload() {
    guardState = await listGuards();
    renderGuardList();
  }

  qs("#guard-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = qs("#guard-create-form button[type='submit']");
    setButtonLoading(submitButton, true, "Creando...");

    try {
      const formData = new FormData(event.currentTarget);
      await createGuard(formData.get("email"), formData.get("password"));
      showToast("Guarda creado correctamente.", "success");
      event.currentTarget.reset();
      await reload();
    } catch (error) {
      showToast(serializeError(error, "No fue posible crear el guarda."), "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

  qs("#guard-list").addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    const guardId = event.target.closest("[data-guard-id]")?.dataset.guardId || event.target.dataset.guardId;
    if (!action || !guardId) {
      return;
    }

    const guard = guardState.find((item) => item.id === guardId);
    if (!guard) {
      return;
    }

    if (action === "edit") {
      openGuardEditModal(guard, reload);
      return;
    }

    if (action === "reset-password") {
      openPasswordResetModal(guard, reload);
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmModal({
        title: "Eliminar guarda",
        description: "La cuenta quedará eliminada del sistema de autenticación y del perfil operativo.",
        confirmText: "Eliminar guarda",
        danger: true,
      });

      if (!confirmed) {
        return;
      }

      try {
        await removeGuard(guard.id);
        showToast("Guarda eliminado correctamente.", "success");
        await reload();
      } catch (error) {
        showToast(serializeError(error), "error");
      }
    }
  });

  try {
    await reload();
  } catch (error) {
    qs("#guard-list").innerHTML = `<div class="panel empty-state">${escapeHtml(serializeError(error))}</div>`;
  }
}

initAdminGuardsPage();
