import {
  buildApartmentLabel,
  normalizePhone,
  uniqueStrings,
} from "../core/utils.js";
import { fetchApartments } from "../data/residents.repository.js";
import { deletePorterOrder, fetchPorterOrders, insertPorterOrder, updatePorterOrder } from "../data/orders.repository.js";
import { getSessionProfile } from "./auth.service.js";
import {
  buildWhatsAppHref,
  logContactAction,
  ORDER_WHATSAPP_MESSAGE,
} from "./contact.service.js";
import { getApartmentContactContextById, getApartmentContactContextByLocation } from "./apartment-contact.service.js";

export const PORTER_ORDER_STATUS = Object.freeze({
  IN_PORTERIA_UNNOTIFIED: "in_porteria_unnotified",
  NOTIFIED_IN_PORTERIA: "notified_in_porteria",
  DELIVERED: "delivered",
});

function formatOrderRecord(order, apartmentsById) {
  const apartment = apartmentsById.get(order.apartment_id) || null;
  return {
    id: order.id,
    apartmentId: order.apartment_id,
    apartment: apartment
      ? {
          id: apartment.id,
          tower: apartment.tower,
          apartmentNumber: apartment.apartment_number,
          label: buildApartmentLabel(apartment.tower, apartment.apartment_number),
        }
      : null,
    status: order.status,
    residentNamesSnapshot: order.resident_names_snapshot || [],
    apartmentPhonesSnapshot: order.apartment_phones_snapshot || [],
    principalPhoneSnapshot: order.principal_phone_snapshot,
    notificationCount: order.notification_count || 0,
    lastNotifiedPhone: order.last_notified_phone,
    lastNotificationMessage: order.last_notification_message,
    receivedAt: order.received_at,
    notifiedAt: order.notified_at,
    deliveredAt: order.delivered_at,
    createdBy: order.created_by,
    updatedBy: order.updated_by,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    missingPrimaryPhone:
      (order.apartment_phones_snapshot || []).length > 0 && !order.principal_phone_snapshot,
  };
}

export async function listPorterOrdersDetailed({ statuses = [], dateFrom = null, dateTo = null } = {}) {
  const orders = await fetchPorterOrders({ statuses, dateFrom, dateTo });
  const apartmentIds = uniqueStrings(orders.map((order) => order.apartment_id));
  const apartments = apartmentIds.length ? await fetchApartments({ ids: apartmentIds }) : [];
  const apartmentsById = new Map(apartments.map((apartment) => [apartment.id, apartment]));
  return orders.map((order) => formatOrderRecord(order, apartmentsById));
}

export async function createPorterOrder({ tower, apartmentNumber }) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa.");
  }

  const contactContext = await getApartmentContactContextByLocation(tower, apartmentNumber);
  if (!contactContext.apartment) {
    throw new Error("No fue posible encontrar el apartamento.");
  }

  return insertPorterOrder({
    apartment_id: contactContext.apartment.id,
    status: PORTER_ORDER_STATUS.IN_PORTERIA_UNNOTIFIED,
    resident_names_snapshot: contactContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: contactContext.apartmentPhones.map((phone) => phone.phone),
    principal_phone_snapshot: contactContext.primaryPhone?.phone || null,
    created_by: sessionProfile.profile.id,
    updated_by: sessionProfile.profile.id,
  });
}

export async function updatePorterOrderBundle({ orderId, tower, apartmentNumber, status }) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa.");
  }

  const contactContext = await getApartmentContactContextByLocation(tower, apartmentNumber);
  if (!contactContext.apartment) {
    throw new Error("No fue posible encontrar el apartamento.");
  }

  return updatePorterOrder(orderId, {
    apartment_id: contactContext.apartment.id,
    status,
    resident_names_snapshot: contactContext.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: contactContext.apartmentPhones.map((phone) => phone.phone),
    principal_phone_snapshot: contactContext.primaryPhone?.phone || null,
    updated_by: sessionProfile.profile.id,
  });
}

export async function markPorterOrderDelivered(orderId) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa.");
  }

  return updatePorterOrder(orderId, {
    status: PORTER_ORDER_STATUS.DELIVERED,
    delivered_at: new Date().toISOString(),
    updated_by: sessionProfile.profile.id,
  });
}

export async function notifyPorterOrderByWhatsApp(orderRecord, phone) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa.");
  }

  await logContactAction({
    actionType: "whatsapp",
    contextType: "order",
    apartmentId: orderRecord.apartmentId,
    porterOrderId: orderRecord.id,
    targetName: orderRecord.residentNamesSnapshot.join(", ") || "Residente",
    phone,
    isPrimaryPhone: normalizePhone(phone) === normalizePhone(orderRecord.principalPhoneSnapshot || ""),
    messageText: ORDER_WHATSAPP_MESSAGE,
  });

  await updatePorterOrder(orderRecord.id, {
    status: PORTER_ORDER_STATUS.NOTIFIED_IN_PORTERIA,
    notification_count: (orderRecord.notificationCount || 0) + 1,
    last_notified_phone: phone,
    last_notification_message: ORDER_WHATSAPP_MESSAGE,
    notified_at: new Date().toISOString(),
    updated_by: sessionProfile.profile.id,
  });

  return buildWhatsAppHref(phone, ORDER_WHATSAPP_MESSAGE);
}

export async function refreshPorterOrderContactSnapshot(orderId) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa.");
  }

  const orders = await fetchPorterOrders();
  const currentOrder = orders.find((order) => order.id === orderId);
  if (!currentOrder) {
    throw new Error("No fue posible encontrar el pedido.");
  }

  const context = await getApartmentContactContextById(currentOrder.apartment_id);
  return updatePorterOrder(orderId, {
    resident_names_snapshot: context.residents.map((resident) => resident.fullName),
    apartment_phones_snapshot: context.apartmentPhones.map((phone) => phone.phone),
    principal_phone_snapshot: context.primaryPhone?.phone || null,
    updated_by: sessionProfile.profile.id,
  });
}

export async function removePorterOrder(orderId) {
  await deletePorterOrder(orderId);
}
