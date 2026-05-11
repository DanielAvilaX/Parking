export const APP_ROLES = Object.freeze({
  ADMIN: "admin",
  GUARD: "guard",
});

export const REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});

export const THEME_OPTIONS = Object.freeze({
  AUTO: "auto",
  LIGHT: "light",
  DARK: "dark",
});

export const PLATE_PATTERNS = Object.freeze({
  CAR: /^[A-Z]{3}\d{3}$/,
  MOTORCYCLE: /^[A-Z]{3}\d{2}[A-Z]$/,
});

export const ROUTES = Object.freeze({
  LOGIN: "/index.html",
  GUARD_HOME: "/guard/index.html",
  REGISTER_RESIDENT: "/guard/register-resident.html",
  REGISTER_VISITOR: "/guard/register-visitor.html",
  ADMIN_RESIDENTS: "/admin/index.html",
  ADMIN_VISITORS: "/admin/visitors.html",
  ADMIN_DASHBOARD: "/admin/dashboard.html",
  ADMIN_REQUESTS: "/admin/requests.html",
  ADMIN_GUARDS: "/admin/guards.html",
  SETTINGS: "/settings/index.html",
});

export const ADMIN_NAV_ITEMS = Object.freeze([
  { href: ROUTES.ADMIN_RESIDENTS, label: "Residentes", key: "residents" },
  { href: ROUTES.ADMIN_VISITORS, label: "Visitantes", key: "visitors" },
  { href: ROUTES.ADMIN_DASHBOARD, label: "Dashboard", key: "dashboard" },
  { href: ROUTES.ADMIN_REQUESTS, label: "Solicitudes", key: "requests" },
  { href: ROUTES.ADMIN_GUARDS, label: "Guardas", key: "guards" },
  { href: ROUTES.SETTINGS, label: "Configuración", key: "settings" },
]);

export const GUARD_NAV_ITEMS = Object.freeze([
  { href: ROUTES.GUARD_HOME, label: "Portería", key: "guard-home" },
  { href: ROUTES.SETTINGS, label: "Configuración", key: "settings" },
]);

