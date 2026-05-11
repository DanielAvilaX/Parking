import {
  createGuardAccount,
  deleteGuardAccount,
  listGuardAccounts,
  resetGuardPassword,
  updateGuardAccount,
} from "../data/guards.repository.js";

export function listGuards() {
  return listGuardAccounts();
}

export function createGuard(email, password) {
  return createGuardAccount(email.trim().toLowerCase(), password);
}

export function updateGuard(guardId, email, isActive) {
  return updateGuardAccount(guardId, email.trim().toLowerCase(), isActive);
}

export function changeGuardPassword(guardId, password) {
  return resetGuardPassword(guardId, password);
}

export function removeGuard(guardId) {
  return deleteGuardAccount(guardId);
}

