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
        <h3>Visitantes en el rango</h3>
        <p>${metrics.rangeVisitorEntries} / ${metrics.rangeVisitorExits}</p>
      </div>
      <span class="badge badge-success">Ingresos / salidas</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Residentes en el rango</h3>
        <p>${metrics.rangeResidentEntries} / ${metrics.rangeResidentExits}</p>
      </div>
      <span class="badge badge-info">Ingresos / salidas</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Vehículos activos ahora</h3>
        <p>${metrics.activeResidents + metrics.activeVisitors}</p>
      </div>
      <span class="badge badge-warning">Residentes: ${metrics.activeResidents} · Visitantes: ${metrics.activeVisitors}</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Alertas operativas</h3>
        <p>${metrics.rangeAlerts + metrics.rangeVisitorNoEntry}</p>
      </div>
      <span class="badge badge-danger">Sin ingreso: ${metrics.rangeAlerts} · No ingresó: ${metrics.rangeVisitorNoEntry}</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Pedidos</h3>
        <p>${metrics.rangeOrdersReceived} / ${metrics.rangeOrdersDelivered}</p>
      </div>
      <span class="badge badge-info">Recibidos / entregados en el rango · Activos ahora: ${metrics.openOrders}</span>
    </article>
    <article class="panel metric-card">
      <div>
        <h3>Contactos</h3>
        <p>${metrics.rangeCalls + metrics.rangeWhatsApp}</p>
      </div>
      <span class="badge">Llamadas: ${metrics.rangeCalls} · WhatsApp: ${metrics.rangeWhatsApp}</span>
    </article>
  `;
}

async function renderCharts(series, metrics, statusBreakdown) {
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
          label: "Ingreso visitantes",
          data: series.visitorEntries,
          backgroundColor: "#b9ff1e",
          borderRadius: 18,
        },
        {
          label: "Salida visitantes",
          data: series.visitorExits,
          backgroundColor: "#2470ff",
          borderRadius: 18,
        },
        {
          label: "Ingreso residentes",
          data: series.residentEntries,
          backgroundColor: "#0f9d6c",
          borderRadius: 18,
        },
        {
          label: "Salida residentes",
          data: series.residentExits,
          backgroundColor: "#ffb020",
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
      labels: statusBreakdown.labels,
      datasets: [
        {
          data: statusBreakdown.values,
          backgroundColor: ["#0f9d6c", "#b9ff1e", "#2470ff", "#ffb020", "#dc4455"],
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
  const granularityInput = qs("#dashboard-granularity");
  const refreshButton = qs("#dashboard-refresh");
  const today = toDateInputValue(new Date());

  fromInput.value = today;
  toInput.value = today;

  async function reload() {
    const range = getRangeBounds(fromInput.value, toInput.value);
    const dashboard = await getDashboardMetrics(range.start, range.end, granularityInput.value);
    renderMetricCards(dashboard.totals);
    await renderCharts(dashboard.trafficSeries, dashboard.totals, dashboard.statusBreakdown);
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
