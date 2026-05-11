import { PLATE_PATTERNS } from "./constants.js";

export function canonicalizePlate(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function formatPlate(value = "") {
  const normalized = canonicalizePlate(value);
  if (!normalized) {
    return "";
  }

  if (normalized.length <= 3) {
    return normalized;
  }

  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

export function isValidPlate(value = "") {
  const normalized = canonicalizePlate(value);
  return PLATE_PATTERNS.CAR.test(normalized) || PLATE_PATTERNS.MOTORCYCLE.test(normalized);
}

export function inferVehicleType(value = "") {
  const normalized = canonicalizePlate(value);
  if (PLATE_PATTERNS.CAR.test(normalized)) {
    return "car";
  }

  if (PLATE_PATTERNS.MOTORCYCLE.test(normalized)) {
    return "motorcycle";
  }

  return null;
}

export function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

export function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => value.trim()).filter(Boolean))];
}

export function uniquePhones(values = []) {
  return [...new Set(values.map(normalizePhone).filter(Boolean))];
}

export function titleCase(value = "") {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function toFriendlyDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function fromDateTimeInputValue(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getTowerOptions() {
  return [1, 2, 3, 4, 5, 6];
}

export function getApartmentOptions() {
  const options = [];
  for (let floor = 1; floor <= 6; floor += 1) {
    for (let slot = 1; slot <= 4; slot += 1) {
      options.push(`${floor}0${slot}`);
    }
  }
  return options;
}

export function isValidApartment(tower, apartmentNumber) {
  const numericTower = Number(tower);
  if (!Number.isInteger(numericTower) || numericTower < 1 || numericTower > 6) {
    return false;
  }

  const options = getApartmentOptions();
  return options.includes(String(apartmentNumber));
}

export function buildApartmentLabel(tower, apartmentNumber) {
  return `Torre ${tower} · Apto ${apartmentNumber}`;
}

export function getQueryParam(name) {
  return new URL(window.location.href).searchParams.get(name);
}

export function setQueryParam(url, key, value) {
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
}

export function sortByText(items, accessor) {
  return [...items].sort((left, right) => accessor(left).localeCompare(accessor(right), "es"));
}

export function groupBy(items, keySelector) {
  return items.reduce((accumulator, item) => {
    const key = keySelector(item);
    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }
    accumulator.get(key).push(item);
    return accumulator;
  }, new Map());
}

export function getLatestTimestamp(...values) {
  return values
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .sort((left, right) => right - left)[0] ?? 0;
}

export function matchesText(value, query) {
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function isSameDay(dateA, dateB) {
  return new Date(dateA).toDateString() === new Date(dateB).toDateString();
}

export function getRangeBounds(dateFrom, dateTo) {
  const start = dateFrom ? new Date(`${dateFrom}T00:00:00`).toISOString() : null;
  const end = dateTo ? new Date(`${dateTo}T23:59:59.999`).toISOString() : null;
  return { start, end };
}

export function serializeError(error, fallback = "Ocurrió un error inesperado.") {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || fallback;
}

export function parseJsonArray(value, fallback = []) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

