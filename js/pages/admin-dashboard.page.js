import { APP_ROLES } from "../core/constants.js";
import { qs } from "../core/dom.js";
import { initTheme } from "../core/theme.js";
import { getRangeBounds, serializeError, toDateInputValue } from "../core/utils.js";
import { requireRole } from "../services/auth.service.js";
import { getDashboardMetrics } from "../services/dashboard.service.js";
import { mountTopbar } from "../ui/layout.js?v=20260511-logo";
import { showToast } from "../ui/notifications.js";

let trafficChart = null;
let statusChart = null;

async function ensureChartLibrary() {
  if (window.Chart) {
    return window.Chart;
  }

  await new Promise((resolve) => {
    const intervalId = window.setInterval(() => {
      if (window.Chart) {
        window.clearInterval(intervalId);
        resolve();
      }
    }, 120);
  });

  return window.Chart;
}

function renderMetricCards(metrics) {
  const container = qs("#dashboard-metrics");
  container.innerHTML = `
    <article class="panel metric-card">
      <div>
        <h3>Ingresos en el rango</h3>
        <p>${metrics.entries}</p>
      </div>
      <span class="badge badge-success">Movimientos de entrada</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Salidas en el rango</h3>
        <p>${metrics.exits}</p>
      </div>
      <span class="badge badge-info">Movimientos de salida</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Vehículos activos</h3>
        <p>${metrics.activeVehicles}</p>
      </div>
      <span class="badge badge-warning">Actualmente dentro</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Salidas sin ingreso</h3>
        <p>${metrics.missingEntryExits}</p>
      </div>
      <span class="badge badge-danger">Revisar en histórico</span>
    </article>
  `;
}

async function renderCharts(series, metrics) {
  const Chart = await ensureChartLibrary();

  if (trafficChart) {
    trafficChart.destroy();
  }

  if (statusChart) {
    statusChart.destroy();
  }

  trafficChart = new Chart(qs("#traffic-chart"), {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Ingresos",
          data: series.entries,
          backgroundColor: "#b9ff1e",
          borderRadius: 18,
        },
        {
          label: "Salidas",
          data: series.exits,
          backgroundColor: "#2470ff",
          borderRadius: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  statusChart = new Chart(qs("#status-chart"), {
    type: "doughnut",
    data: {
      labels: ["Activos", "Salidas sin ingreso", "Salidas registradas"],
      datasets: [
        {
          data: [metrics.activeVehicles, metrics.missingEntryExits, metrics.exits],
          backgroundColor: ["#b9ff1e", "#dc4455", "#2470ff"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

async function initAdminDashboardPage() {
  initTheme();
  const sessionProfile = await requireRole([APP_ROLES.ADMIN]);
  if (!sessionProfile) {
    return;
  }

  mountTopbar({
    role: APP_ROLES.ADMIN,
    activeKey: "dashboard",
    subtitle: "Panel administrativo",
  });

  const fromInput = qs("#dashboard-date-from");
  const toInput = qs("#dashboard-date-to");
  const refreshButton = qs("#dashboard-refresh");
  const today = toDateInputValue(new Date());

  fromInput.value = today;
  toInput.value = today;

  async function reload() {
    const range = getRangeBounds(fromInput.value, toInput.value);
    const dashboard = await getDashboardMetrics(range.start, range.end);
    renderMetricCards(dashboard.totals);
    await renderCharts(dashboard.trafficSeries, dashboard.totals);
  }

  refreshButton.addEventListener("click", async () => {
    try {
      await reload();
    } catch (error) {
      showToast(serializeError(error), "error");
    }
  });

  try {
    await reload();
  } catch (error) {
    showToast(serializeError(error), "error");
  }
}

initAdminDashboardPage();
