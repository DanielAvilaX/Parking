import { THEME_OPTIONS } from "./constants.js";

const THEME_KEY = "davinci-theme-preference";
let themeTimerId = null;

function resolveAutomaticTheme() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? THEME_OPTIONS.LIGHT : THEME_OPTIONS.DARK;
}

export function getStoredThemePreference() {
  return window.localStorage.getItem(THEME_KEY) || THEME_OPTIONS.AUTO;
}

export function resolveTheme(preference = getStoredThemePreference()) {
  return preference === THEME_OPTIONS.AUTO ? resolveAutomaticTheme() : preference;
}

export function applyTheme(preference = getStoredThemePreference()) {
  const appliedTheme = resolveTheme(preference);
  document.documentElement.dataset.theme = appliedTheme;
  document.documentElement.dataset.themePreference = preference;
  return appliedTheme;
}

export function saveThemePreference(preference) {
  window.localStorage.setItem(THEME_KEY, preference);
  return applyTheme(preference);
}

export function initTheme() {
  const preference = getStoredThemePreference();
  applyTheme(preference);

  if (themeTimerId) {
    window.clearInterval(themeTimerId);
  }

  themeTimerId = window.setInterval(() => {
    if (getStoredThemePreference() === THEME_OPTIONS.AUTO) {
      applyTheme(THEME_OPTIONS.AUTO);
    }
  }, 60_000);

  return preference;
}

