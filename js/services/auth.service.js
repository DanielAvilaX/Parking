import { ROUTES, APP_ROLES } from "../core/constants.js";
import { runtimeConfig } from "../config/runtime-config.js";
import { fetchCurrentProfile } from "../data/auth.repository.js";
import { supabase } from "../core/supabase-client.js";
import {
  clearStoredSession,
  getModeForRole,
  setSessionPersistenceMode,
} from "../core/storage.js";

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  const profile = await fetchCurrentProfile();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    throw new Error("Tu cuenta no tiene un perfil activo en el sistema.");
  }

  setSessionPersistenceMode(getModeForRole(profile.role));
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return { session: data.session, profile };
}

export async function getSessionProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const profile = await fetchCurrentProfile();
  if (!profile || !profile.is_active) {
    await logout(false);
    return null;
  }

  return { session, profile };
}

export async function requireRole(allowedRoles = []) {
  const sessionProfile = await getSessionProfile();
  if (!sessionProfile) {
    window.location.href = ROUTES.LOGIN;
    return null;
  }

  if (allowedRoles.length && !allowedRoles.includes(sessionProfile.profile.role)) {
    window.location.href =
      sessionProfile.profile.role === APP_ROLES.ADMIN ? ROUTES.ADMIN_RESIDENTS : ROUTES.GUARD_HOME;
    return null;
  }

  return sessionProfile;
}

export function redirectToRoleHome(role) {
  window.location.href = role === APP_ROLES.ADMIN ? ROUTES.ADMIN_RESIDENTS : ROUTES.GUARD_HOME;
}

export async function redirectAuthenticatedUser() {
  const sessionProfile = await getSessionProfile();
  if (sessionProfile) {
    redirectToRoleHome(sessionProfile.profile.role);
    return true;
  }

  return false;
}

export async function logout(redirect = true) {
  await supabase.auth.signOut();
  clearStoredSession(runtimeConfig.authStorageKey);
  if (redirect) {
    window.location.href = ROUTES.LOGIN;
  }
}

export async function sendPasswordRecovery(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL(ROUTES.LOGIN, window.location.origin).toString(),
  });

  if (error) {
    throw error;
  }
}

export async function updateRecoveredPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }
}

export async function updateOwnCredentials({ email, password }) {
  const payload = {};
  if (email) {
    payload.email = email;
  }
  if (password) {
    payload.password = password;
  }

  const { error } = await supabase.auth.updateUser(payload);
  if (error) {
    throw error;
  }
}
