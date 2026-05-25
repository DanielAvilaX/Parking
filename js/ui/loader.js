let inFlightCount = 0;
let overlayElement = null;
let showTimerId = null;
let hideTimerId = null;

const SHOW_DELAY_MS = 120;
const HIDE_DEBOUNCE_MS = 220;

function ensureOverlay() {
  if (overlayElement) {
    return overlayElement;
  }

  overlayElement = document.createElement("dialog");
  overlayElement.className = "loader-overlay";
  overlayElement.innerHTML = '<div class="loader" role="status" aria-label="Cargando"></div>';
  overlayElement.addEventListener("cancel", (event) => event.preventDefault());
  document.body.appendChild(overlayElement);
  return overlayElement;
}

function clearShowTimer() {
  if (showTimerId !== null) {
    window.clearTimeout(showTimerId);
    showTimerId = null;
  }
}

function clearHideTimer() {
  if (hideTimerId !== null) {
    window.clearTimeout(hideTimerId);
    hideTimerId = null;
  }
}

function openOverlayNow() {
  const el = ensureOverlay();
  if (!el.open) {
    el.showModal();
  }
}

function closeOverlayNow() {
  if (overlayElement?.open) {
    overlayElement.close();
  }
}

export function beginLoading() {
  inFlightCount += 1;
  clearHideTimer();

  if (overlayElement?.open || showTimerId !== null) {
    return;
  }

  showTimerId = window.setTimeout(() => {
    showTimerId = null;
    if (inFlightCount > 0) {
      openOverlayNow();
    }
  }, SHOW_DELAY_MS);
}

export function endLoading() {
  inFlightCount = Math.max(0, inFlightCount - 1);
  if (inFlightCount > 0) {
    return;
  }

  clearShowTimer();

  if (!overlayElement?.open) {
    return;
  }

  clearHideTimer();
  hideTimerId = window.setTimeout(() => {
    hideTimerId = null;
    if (inFlightCount === 0) {
      closeOverlayNow();
    }
  }, HIDE_DEBOUNCE_MS);
}

export async function withLoader(task) {
  beginLoading();
  try {
    return await task();
  } finally {
    endLoading();
  }
}
