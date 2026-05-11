import { escapeHtml } from "../core/utils.js";

export function showToast(message, tone = "info", timeoutMs = 3600) {
  const root = document.getElementById("toast-root");
  if (!root) {
    return;
  }

  const toast = document.createElement("article");
  toast.className = `toast toast--${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  root.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, timeoutMs);
}

