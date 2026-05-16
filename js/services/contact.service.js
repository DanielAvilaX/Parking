import { buildApartmentLabel, canonicalizePlate, formatPlate, normalizePhone } from "../core/utils.js";
import { insertContactActionLog } from "../data/contact-actions.repository.js";
import { getSessionProfile } from "./auth.service.js";
import {
  getApartmentContactContextById,
  getApartmentContactContextByLocation,
  setApartmentPrimaryPhone,
} from "./apartment-contact.service.js";

export const ORDER_WHATSAPP_MESSAGE =
  "Hola, te informamos desde portería que tienes un pedido recibido a tu nombre. Se encuentra disponible en portería para su recogida.";

export const GENERAL_CONTACT_MESSAGE =
  "Hola, te contactamos desde portería de Registro de Vehículos Davinci.";

export function buildVisitorAnnouncementMessage({ plate, tower, apartmentNumber }) {
  return `Hola, desde portería te informamos que el vehículo de placa ${formatPlate(
    plate
  )} se encuentra anunciado para la Torre ${tower}, Apartamento ${apartmentNumber}.`;
}

export function buildTelHref(phone) {
  return `tel:${normalizePhone(phone)}`;
}

export function buildWhatsAppHref(phone, message) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

export async function listApartmentContactOptions(apartmentId) {
  return getApartmentContactContextById(apartmentId);
}

export async function listApartmentContactOptionsByLocation(tower, apartmentNumber) {
  return getApartmentContactContextByLocation(tower, apartmentNumber);
}

export async function defineApartmentPrimaryPhone(apartmentId, phoneId) {
  return setApartmentPrimaryPhone(apartmentId, phoneId);
}

export async function defineApartmentPrimaryPhoneByLocation({ tower, apartmentNumber, phone }) {
  const context = await getApartmentContactContextByLocation(tower, apartmentNumber);
  const normalizedPhone = normalizePhone(phone);
  const targetPhone = context.apartmentPhones.find((item) => item.phoneNormalized === normalizedPhone);

  if (!targetPhone) {
    throw new Error("El número principal seleccionado no existe en el apartamento indicado.");
  }

  return setApartmentPrimaryPhone(context.apartment.id, targetPhone.id);
}

export async function logContactAction({
  actionType,
  contextType,
  apartmentId = null,
  residentId = null,
  visitorVehicleId = null,
  porterOrderId = null,
  plate = null,
  targetName = null,
  phone,
  isPrimaryPhone = false,
  messageText = null,
}) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    throw new Error("No existe una sesión activa para registrar el contacto.");
  }

  return insertContactActionLog({
    action_type: actionType,
    context_type: contextType,
    apartment_id: apartmentId,
    resident_id: residentId,
    visitor_vehicle_id: visitorVehicleId,
    porter_order_id: porterOrderId,
    plate_display: plate ? formatPlate(plate) : null,
    plate_normalized: plate ? canonicalizePlate(plate) : null,
    target_name: targetName,
    phone,
    phone_normalized: normalizePhone(phone),
    is_primary_phone: isPrimaryPhone,
    message_text: messageText,
    initiated_by: sessionProfile.profile.id,
    initiated_by_role: sessionProfile.profile.role,
  });
}

export function buildApartmentAlertText(contactContext) {
  if (!contactContext?.apartment) {
    return "No existe contexto de apartamento.";
  }

  if (!contactContext.apartmentPhones.length) {
    return `El ${buildApartmentLabel(
      contactContext.apartment.tower,
      contactContext.apartment.apartmentNumber || contactContext.apartment.apartment_number
    )} no tiene números de apartamento disponibles.`;
  }

  if (contactContext.missingPrimaryPhone) {
    return `El ${contactContext.apartment.label} tiene números registrados pero no tiene número principal definido.`;
  }

  return "";
}
