import { APP_ROLES } from "../core/constants.js";
import { fillSelect, qs } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import {
  escapeHtml,
  getApartmentOptions,
  getTowerOptions,
  serializeError,
  toFriendlyDate,
} from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import {
  buildApartmentAlertText,
  buildTelHref,
  defineApartmentPrimaryPhone,
  defineApartmentPrimaryPhoneByLocation,
  listApartmentContactOptions,
  listApartmentContactOptionsByLocation,
  logContactAction,
} from "../services/contact.service.js";
import {
  createPorterOrder,
  listPorterOrdersDetailed,
  markPorterOrderDelivered,
  notifyPorterOrderByWhatsApp,
  PORTER_ORDER_STATUS,
  refreshPorterOrderContactSnapshot,
  removePorterOrder,
  updatePorterOrderBundle,
} from "../services/order.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { confirmModal, openFormModal } from "../ui/modal.js?v=20260514-phase1c";
import { showToast } from "../ui/notifications.js";

let orderState = [];
let currentRole = APP_ROLES.GUARD;

function renderTowerOptions() {
  return getTowerOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderApartmentOptions() {
  return getApartmentOptions().map((value) => `<option value="${value}">${value}</option>`).join("");
}

async function renderOrderPrimaryPhoneField(dialog) {
  const container = dialog.querySelector("#order-primary-phone-config");
  if (!container) {
    return;
  }

  const tower = dialog.querySelector("#edit-order-tower")?.value;
  const apartment = dialog.querySelector("#edit-order-apartment")?.value;

  if (!tower || !apartment) {
    container.innerHTML = '<p class="muted">Selecciona torre y apartamento para definir el número principal.</p>';
    return;
  }

  try {
    const contactContext = await listApartmentContactOptionsByLocation(tower, apartment);
    container.innerHTML = `
      <div class="field">
        <label for="edit-order-primary-phone">Número principal del apartamento</label>
        <select id="edit-order-primary-phone" name="primaryPhone">
          <option value="">Sin definir</option>
          ${contactContext.apartmentPhones
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
          contactContext.apartmentPhones.length
            ? '<p class="helper-text">Puedes cambiar aquí el principal que usarán las llamadas y notificaciones.</p>'
            : '<p class="helper-text">Este apartamento no tiene teléfonos disponibles todavía.</p>'
        }
      </div>
    `;
  } catch (error) {
    container.innerHTML = `<p class="helper-text">${escapeHtml(serializeError(error, "No fue posible cargar los teléfonos del apartamento."))}</p>`;
  }
}

function renderStatusBadge(status) {
  if (status === PORTER_ORDER_STATUS.DELIVERED) {
    return '<span class="badge badge-success">Entregado</span>';
  }

  if (status === PORTER_ORDER_STATUS.NOTIFIED_IN_PORTERIA) {
    return '<span class="badge badge-info">Notificado y en portería</span>';
  }

  return '<span class="badge badge-warning">En portería sin notificar</span>';
}

function applyFilters() {
  const status = qs("#orders-filter-status").value;
  const tower = qs("#orders-filter-tower").value;
  const apartment = qs("#orders-filter-apartment").value.trim().toLowerCase();
  const from = qs("#orders-filter-date-from").value;
  const to = qs("#orders-filter-date-to").value;

  return orderState.filter((order) => {
    const matchesStatus = status === "all" || order.status === status;
    const matchesTower = !tower || String(order.apartment?.tower || "") === tower;
    const matchesApartment =
      !apartment || String(order.apartment?.apartmentNumber || "").toLowerCase().includes(apartment);
    const receivedDate = order.receivedAt ? new Date(order.receivedAt) : null;
    const matchesFrom = !from || (receivedDate && receivedDate >= new Date(`${from}T00:00:00`));
    const matchesTo = !to || (receivedDate && receivedDate <= new Date(`${to}T23:59:59`));
    return matchesStatus && matchesTower && matchesApartment && matchesFrom && matchesTo;
  });
}

function renderOrdersTable() {
  const rows = applyFilters();
  qs("#orders-table-body").innerHTML = rows.length
    ? rows
        .map(
          (order) => `
            <tr data-order-id="${order.id}">
              <td>${escapeHtml(order.apartment?.label || "Sin apartamento")}</td>
              <td>${escapeHtml(order.residentNamesSnapshot.join(", ") || "Sin residentes")}</td>
              <td>
                ${
                  order.principalPhoneSnapshot
                    ? `<span class="badge badge-info">${escapeHtml(order.principalPhoneSnapshot)}</span>`
                    : '<span class="badge badge-danger">Sin principal</span>'
                }
              </td>
              <td>${renderStatusBadge(order.status)}</td>
              <td>${escapeHtml(toFriendlyDate(order.receivedAt))}</td>
              <td>${escapeHtml(order.notifiedAt ? toFriendlyDate(order.notifiedAt) : "No notificado")}</td>
              <td>${escapeHtml(order.deliveredAt ? toFriendlyDate(order.deliveredAt) : "Pendiente")}</td>
              <td>
                <div class="action-row">
                  <button class="button-ghost" type="button" data-action="call-order" data-order-id="${order.id}">Llamar</button>
                  <button class="button-ghost" type="button" data-action="notify-order" data-order-id="${order.id}">WhatsApp</button>
                  <button class="button-ghost" type="button" data-action="edit-order" data-order-id="${order.id}">Editar</button>
                  ${
                    currentRole === APP_ROLES.GUARD
                      ? `<button class="button" type="button" data-action="deliver-order" data-order-id="${order.id}">Entregado</button>`
                      : ""
                  }
                  <button class="button-danger" type="button" data-action="delete-order" data-order-id="${order.id}">Eliminar</button>
                </div>
              </td>
            </tr>
          `
        )
        .join("")
    : '<tr><td colspan="8">No hay pedidos con estos filtros.</td></tr>';
}

function openCreateOrderModal(reload) {
  openFormModal({
    title: "Registrar pedido",
    description: "Selecciona el apartamento al que pertenece el pedido recibido en portería.",
    submitText: "Registrar pedido",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="order-tower">Torre</label>
          <select id="order-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="order-apartment">Apartamento</label>
          <select id="order-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
    `,
    onSubmit: async (formData) => {
      await createPorterOrder({
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
      });
      showToast("Pedido registrado correctamente.", "success");
      await reload();
    },
  });
}

function openEditOrderModal(order, reload) {
  openFormModal({
    title: "Editar pedido",
    description: "Puedes cambiar el apartamento asociado y el estado del pedido.",
    submitText: "Guardar cambios",
    content: `
      <div class="field-grid">
        <div class="field">
          <label for="edit-order-tower">Torre</label>
          <select id="edit-order-tower" name="tower" required>
            <option value="">Selecciona</option>
            ${renderTowerOptions()}
          </select>
        </div>
        <div class="field">
          <label for="edit-order-apartment">Apartamento</label>
          <select id="edit-order-apartment" name="apartment" required>
            <option value="">Selecciona</option>
            ${renderApartmentOptions()}
          </select>
        </div>
      </div>
      <div class="field">
        <label for="edit-order-status">Estado</label>
        <select id="edit-order-status" name="status" required>
          <option value="${PORTER_ORDER_STATUS.IN_PORTERIA_UNNOTIFIED}">En portería sin notificar</option>
          <option value="${PORTER_ORDER_STATUS.NOTIFIED_IN_PORTERIA}">Notificado y en portería</option>
          <option value="${PORTER_ORDER_STATUS.DELIVERED}">Entregado</option>
        </select>
      </div>
      <div id="order-primary-phone-config" class="content-stack"></div>
    `,
    onOpen: async (dialog) => {
      dialog.querySelector("#edit-order-tower").value = String(order.apartment?.tower || "");
      dialog.querySelector("#edit-order-apartment").value = String(order.apartment?.apartmentNumber || "");
      dialog.querySelector("#edit-order-status").value = order.status;
      await renderOrderPrimaryPhoneField(dialog);
      dialog
        .querySelector("#edit-order-tower")
        ?.addEventListener("change", () => void renderOrderPrimaryPhoneField(dialog));
      dialog
        .querySelector("#edit-order-apartment")
        ?.addEventListener("change", () => void renderOrderPrimaryPhoneField(dialog));
    },
    onSubmit: async (formData) => {
      await updatePorterOrderBundle({
        orderId: order.id,
        tower: formData.get("tower"),
        apartmentNumber: formData.get("apartment"),
        status: formData.get("status"),
      });

      const selectedPrimaryPhone = formData.get("primaryPhone");
      if (selectedPrimaryPhone) {
        await defineApartmentPrimaryPhoneByLocation({
          tower: formData.get("tower"),
          apartmentNumber: formData.get("apartment"),
          phone: selectedPrimaryPhone,
        });
        await refreshPorterOrderContactSnapshot(order.id);
      }

      showToast("Pedido actualizado correctamente.", "success");
      await reload();
    },
  });
}

function openNotifyOrderModal(order, reload) {
  const optionsMarkup = order.apartmentPhonesSnapshot.length
    ? order.apartmentPhonesSnapshot
        .map(
          (phone, index) => `
            <label class="option-card">
              <input type="radio" name="phone" value="${escapeHtml(phone)}" ${index === 0 ? "checked" : ""} />
              <span>${escapeHtml(phone)}</span>
              ${order.principalPhoneSnapshot === phone ? '<span class="badge badge-info">Principal</span>' : ""}
            </label>
          `
        )
        .join("")
    : '<p class="muted">No hay teléfonos registrados para este pedido.</p>';

  openFormModal({
    title: "Notificar por WhatsApp",
    description: order.missingPrimaryPhone
      ? "Este apartamento no tiene número principal definido, pero puedes escoger cualquier número."
      : "Selecciona el número al que vas a enviar la notificación.",
    submitText: "Abrir WhatsApp",
    content: `
      <div class="content-stack">
        ${order.missingPrimaryPhone ? '<div class="inline-note inline-note--danger">No existe número principal definido para este apartamento.</div>' : ""}
        <div class="choice-stack">${optionsMarkup}</div>
      </div>
    `,
    onSubmit: async (formData) => {
      const phone = formData.get("phone");
      if (!phone) {
        throw new Error("Selecciona un número para notificar.");
      }

      const href = await notifyPorterOrderByWhatsApp(order, phone);
      window.open(href, "_blank", "noopener");
      showToast("Se registró la notificación manual por WhatsApp.", "success");
      await reload();
    },
  });
}

async function openCallOrderModal(order, reload) {
  if (!order.apartmentId) {
    throw new Error("Este pedido no tiene un apartamento asociado.");
  }

  const contactContext = await listApartmentContactOptions(order.apartmentId);
  if (!contactContext.apartmentPhones.length) {
    throw new Error("Este apartamento no tiene números disponibles para llamada.");
  }

  const warningText = buildApartmentAlertText(contactContext);

  openFormModal({
    title: "Llamar al apartamento",
    description: contactContext.apartment?.label || "Selecciona el número a utilizar.",
    submitText: "Llamar",
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
        await defineApartmentPrimaryPhone(order.apartmentId, selectedPhone.id);
        await refreshPorterOrderContactSnapshot(order.id);
      }

      await logContactAction({
        actionType: "call",
        contextType: "order",
        apartmentId: order.apartmentId,
        porterOrderId: order.id,
        targetName: order.residentNamesSnapshot.join(", ") || "Residente",
        phone: selectedPhone.phone,
        isPrimaryPhone: selectedPhone.isPrimary || Boolean(formData.get("setPrimary")),
      });

      window.location.href = buildTelHref(selectedPhone.phone);
      showToast("Se registró la llamada al apartamento.", "success");
      await reload();
    },
  });
}

async function initOrdersPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN, APP_ROLES.GUARD]);
  if (!sessionProfile) {
    return;
  }

  currentRole = sessionProfile.profile.role;

  mountTopbar({
    role: sessionProfile.profile.role,
    activeKey: "orders",
    subtitle: sessionProfile.profile.role === APP_ROLES.ADMIN ? "Panel administrativo" : "Portería operativa",
  });

  fillSelect(qs("#orders-filter-tower"), getTowerOptions(), "Todas las torres");

  if (currentRole !== APP_ROLES.GUARD) {
    qs("#create-order-button").hidden = true;
  }

  async function reload() {
    orderState = await listPorterOrdersDetailed();
    renderOrdersTable();
  }

  qs("#create-order-button").addEventListener("click", () => openCreateOrderModal(reload));

  [
    "#orders-filter-status",
    "#orders-filter-tower",
    "#orders-filter-apartment",
    "#orders-filter-date-from",
    "#orders-filter-date-to",
  ].forEach((selector) => {
    qs(selector).addEventListener("input", renderOrdersTable);
    qs(selector).addEventListener("change", renderOrdersTable);
  });

  qs("#orders-table-body").addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    const action = actionElement?.dataset.action;
    const orderId = actionElement?.dataset.orderId;
    if (!actionElement || !action || !orderId) {
      return;
    }

    const order = orderState.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    try {
      if (action === "notify-order") {
        openNotifyOrderModal(order, reload);
        return;
      }

      if (action === "call-order") {
        await openCallOrderModal(order, reload);
        return;
      }

      if (action === "edit-order") {
        openEditOrderModal(order, reload);
        return;
      }

      if (action === "deliver-order") {
        const confirmed = await confirmModal({
          title: "Marcar pedido como entregado",
          description: "El pedido quedará en estado entregado.",
          confirmText: "Marcar entregado",
        });

        if (!confirmed) {
          return;
        }

        await markPorterOrderDelivered(order.id);
        showToast("Pedido marcado como entregado.", "success");
        await reload();
        return;
      }

      if (action === "delete-order") {
        const confirmed = await confirmModal({
          title: "Eliminar pedido",
          description: "Se eliminará el registro del pedido seleccionado.",
          confirmText: "Eliminar pedido",
          danger: true,
        });

        if (!confirmed) {
          return;
        }

        await removePorterOrder(order.id);
        showToast("Pedido eliminado correctamente.", "success");
        await reload();
        return;
      }
    } catch (error) {
      showToast(serializeError(error, "No fue posible completar la acción."), "error");
    }
  });

  try {
    await reload();
  } catch (error) {
    qs("#orders-table-body").innerHTML = `<tr><td colspan="8">${escapeHtml(serializeError(error))}</td></tr>`;
  }
}

initOrdersPage();
