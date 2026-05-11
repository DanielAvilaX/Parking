import { APP_ROLES, ADMIN_NAV_ITEMS, GUARD_NAV_ITEMS, ROUTES } from "../core/constants.js";
import { runtimeConfig } from "../config/runtime-config.js";
import { logout } from "../services/auth.service.js";

function buildNavigation(role, activeKey) {
  const items = role === APP_ROLES.ADMIN ? ADMIN_NAV_ITEMS : GUARD_NAV_ITEMS;
  return items
    .map(
      (item) =>
        `<a class="nav-pill ${item.key === activeKey ? "is-active" : ""}" href="${item.href}">${item.label}</a>`
    )
    .join("");
}

export function mountTopbar({ role, activeKey, subtitle }) {
  const shell = document.getElementById("app-shell");
  if (!shell) {
    return;
  }

  const wrapper = document.createElement("header");
  wrapper.className = "topbar";
  wrapper.innerHTML = `
    <div class="topbar__inner">
      <div class="brand">
        <div class="brand__mark">
          <img src="/assets/logo-placeholder.png" alt="Logo de ${runtimeConfig.siteName}" />
        </div>
        <div class="brand__copy">
          <h1>${runtimeConfig.siteName}</h1>
          <p>${subtitle}</p>
        </div>
      </div>
      <nav class="topbar__nav">${buildNavigation(role, activeKey)}</nav>
      <div class="topbar__actions">
        <button id="logout-button" class="button" type="button">Cerrar sesión</button>
      </div>
    </div>
  `;

  shell.prepend(wrapper);
  wrapper.querySelector("#logout-button")?.addEventListener("click", async () => {
    await logout();
  });
}
