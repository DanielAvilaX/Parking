export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

export function setButtonLoading(button, isLoading, loadingLabel = "Procesando...") {
  if (!button) {
    return;
  }

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? loadingLabel : button.dataset.defaultLabel;
}

export function fillSelect(select, options, placeholder = "Selecciona una opción") {
  if (!select) {
    return;
  }

  const optionMarkup = options
    .map((option) => {
      const value = typeof option === "object" ? option.value : option;
      const label = typeof option === "object" ? option.label : option;
      return `<option value="${value}">${label}</option>`;
    })
    .join("");

  select.innerHTML = `<option value="">${placeholder}</option>${optionMarkup}`;
}

export function renderEmptyState(container, message) {
  container.innerHTML = `<div class="empty-state">${message}</div>`;
}

export function createFieldRow(values = {}) {
  return values;
}

