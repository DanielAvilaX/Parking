import { fetchDashboardLogs } from "../data/dashboard.repository.js";

function groupLogsByDate(logs) {
  return logs.reduce((accumulator, log) => {
    const date = new Date(log.created_at).toISOString().slice(0, 10);
    if (!accumulator[date]) {
      accumulator[date] = {
        entries: 0,
        exits: 0,
      };
    }

    if (log.entry_at) {
      accumulator[date].entries += 1;
    }

    if (log.exit_at) {
      accumulator[date].exits += 1;
    }

    return accumulator;
  }, {});
}

export async function getDashboardMetrics(dateFrom, dateTo) {
  const logs = await fetchDashboardLogs(dateFrom, dateTo);
  const grouped = groupLogsByDate(logs);
  const labels = Object.keys(grouped).sort();

  return {
    totals: {
      entries: logs.filter((log) => log.entry_at).length,
      exits: logs.filter((log) => log.exit_at).length,
      activeVehicles: logs.filter((log) => log.entry_at && !log.exit_at).length,
      missingEntryExits: logs.filter((log) => log.entry_missing).length,
    },
    trafficSeries: {
      labels,
      entries: labels.map((label) => grouped[label].entries),
      exits: labels.map((label) => grouped[label].exits),
    },
  };
}
