import { escapeHtml, serializeError } from "../core/utils.js";
import { showToast } from "./notifications.js";

function getDialog() {
  return document.getElementById("app-modal");
}

function isTemporaryDialog(dialog) {
  return dialog?.dataset?.temporaryModal === "true";
}

function createTemporaryDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "app-modal";
  dialog.dataset.temporaryModal = "true";
  document.body.appendChild(dialog);
  return dialog;
}

export function closeAllModals() {
  document.querySelectorAll("dialog.app-modal").forEach((dialog) => {
    if (dialog.open || dialog.innerHTML) {
      closeDialog(dialog);
    }
  });
}

function closeDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
  dialog.innerHTML = "";
  if (isTemporaryDialog(dialog)) {
    dialog.remove();
  }
}

export function openFormModal({
  title,
  description = "",
  submitText = "Guardar",
  cancelText = "Cancelar",
  content = "",
  danger = false,
  onOpen,
  onSubmit,
}) {
  const dialog = getDialog();
  dialog.innerHTML = `
    <form method="dialog" class="modal__content" id="modal-form">
      <header class="modal__header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p class="muted">${escapeHtml(description)}</p>
        </div>
        <button type="button" class="button-ghost" id="modal-close">Cerrar</button>
      </header>
      ${content}
      <footer class="modal__actions">
        <button type="button" class="button-ghost" id="modal-cancel">${escapeHtml(cancelText)}</button>
        <button type="submit" class="${danger ? "button-danger" : "button"}">${escapeHtml(submitText)}</button>
      </footer>
    </form>
  `;

  const form = dialog.querySelector("#modal-form");
  const closeButton = dialog.querySelector("#modal-close");
  const cancelButton = dialog.querySelector("#modal-cancel");

  const cleanup = () => closeDialog(dialog);
  closeButton.addEventListener("click", cleanup);
  cancelButton.addEventListener("click", cleanup);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const shouldClose = await onSubmit?.(new FormData(form), dialog);
      if (shouldClose !== false) {
        closeAllModals();
      }
    } catch (error) {
      showToast(serializeError(error, "No fue posible completar la acción."), "error");
    }
  });

  dialog.showModal();
  onOpen?.(dialog);
}

export function confirmModal({
  title,
  description = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    const baseDialog = getDialog();
    const dialog = baseDialog?.open ? createTemporaryDialog() : baseDialog;
    let settled = false;

    const finalize = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
      if (dialog.open) {
        closeDialog(dialog);
      }
    };

    dialog.innerHTML = `
      <div class="modal__content">
        <header class="modal__header">
          <div>
            <h2>${escapeHtml(title)}</h2>
            <p class="muted">${escapeHtml(description)}</p>
          </div>
        </header>
        <footer class="modal__actions">
          <button type="button" class="button-ghost" id="modal-cancel">${escapeHtml(cancelText)}</button>
          <button type="button" class="${danger ? "button-danger" : "button"}" id="modal-confirm">${escapeHtml(confirmText)}</button>
        </footer>
      </div>
    `;

    dialog.querySelector("#modal-cancel")?.addEventListener("click", () => {
      finalize(false);
    });
    dialog.querySelector("#modal-confirm")?.addEventListener("click", () => {
      finalize(true);
    });
    dialog.addEventListener("close", () => finalize(false), { once: true });

    dialog.showModal();
  });
}
