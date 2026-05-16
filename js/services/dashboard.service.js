import { fetchDashboardSnapshot } from "../data/dashboard.repository.js";

function isWithinRange(value, dateFrom, dateTo) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  if (dateFrom && timestamp < new Date(dateFrom).getTime()) {
    return false;
  }
  if (dateTo && timestamp > new Date(dateTo).getTime()) {
    return false;
  }
  return true;
}

function toDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildDateLabels(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) {
    return [];
  }

  const labels = [];
  const cursor = new Date(dateFrom);
  const end = new Date(dateTo);

  while (cursor.getTime() <= end.getTime()) {
    labels.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return labels;
}

function seedSeries(labels) {
  return labels.reduce((accumulator, label) => {
    accumulator[label] = {
      visitorEntries: 0,
      visitorExits: 0,
      residentEntries: 0,
      residentExits: 0,
    };
    return accumulator;
  }, {});
}

function applyEventToSeries(seriesMap, value, key) {
  if (!value) {
    return;
  }

  const dateKey = toDateKey(value);
  if (!seriesMap[dateKey]) {
    seriesMap[dateKey] = {
      visitorEntries: 0,
      visitorExits: 0,
      residentEntries: 0,
      residentExits: 0,
    };
  }
  seriesMap[dateKey][key] += 1;
}

function buildTrafficSeries({ visitorLogs, residentLogs, dateFrom, dateTo, granularity }) {
  const labels = buildDateLabels(dateFrom, dateTo);
  const seriesMap = seedSeries(labels);

  visitorLogs.forEach((log) => {
    if (isWithinRange(log.entry_at, dateFrom, dateTo)) {
      applyEventToSeries(seriesMap, log.entry_at, "visitorEntries");
    }
    if (isWithinRange(log.exit_at, dateFrom, dateTo)) {
      applyEventToSeries(seriesMap, log.exit_at, "visitorExits");
    }
  });

  residentLogs.forEach((log) => {
    if (isWithinRange(log.entry_at, dateFrom, dateTo)) {
      applyEventToSeries(seriesMap, log.entry_at, "residentEntries");
    }
    if (isWithinRange(log.exit_at, dateFrom, dateTo)) {
      applyEventToSeries(seriesMap, log.exit_at, "residentExits");
    }
  });

  const normalizedLabels = Object.keys(seriesMap).sort();
  const dailySeries = {
    labels: normalizedLabels,
    visitorEntries: normalizedLabels.map((label) => seriesMap[label].visitorEntries),
    visitorExits: normalizedLabels.map((label) => seriesMap[label].visitorExits),
    residentEntries: normalizedLabels.map((label) => seriesMap[label].residentEntries),
    residentExits: normalizedLabels.map((label) => seriesMap[label].residentExits),
  };

  if (granularity === "range") {
    return {
      labels: ["Rango seleccionado"],
      visitorEntries: [dailySeries.visitorEntries.reduce((sum, value) => sum + value, 0)],
      visitorExits: [dailySeries.visitorExits.reduce((sum, value) => sum + value, 0)],
      residentEntries: [dailySeries.residentEntries.reduce((sum, value) => sum + value, 0)],
      residentExits: [dailySeries.residentExits.reduce((sum, value) => sum + value, 0)],
    };
  }

  return dailySeries;
}

export async function getDashboardMetrics(dateFrom, dateTo, granularity = "day") {
  const snapshot = await fetchDashboardSnapshot();

  const rangeVisitorEntries = snapshot.visitorLogs.filter((log) => isWithinRange(log.entry_at, dateFrom, dateTo)).length;
  const rangeVisitorExits = snapshot.visitorLogs.filter((log) => isWithinRange(log.exit_at, dateFrom, dateTo)).length;
  const rangeResidentEntries = snapshot.residentLogs.filter((log) => isWithinRange(log.entry_at, dateFrom, dateTo)).length;
  const rangeResidentExits = snapshot.residentLogs.filter((log) => isWithinRange(log.exit_at, dateFrom, dateTo)).length;
  const rangeVisitorNoEntry = snapshot.visitorLogs.filter((log) => isWithinRange(log.no_entry_at, dateFrom, dateTo)).length;
  const rangeAlerts = [
    ...snapshot.visitorLogs.filter((log) => log.entry_missing && isWithinRange(log.exit_at || log.created_at, dateFrom, dateTo)),
    ...snapshot.residentLogs.filter((log) => log.entry_missing && isWithinRange(log.exit_at || log.created_at, dateFrom, dateTo)),
  ].length;
  const rangeOrdersReceived = snapshot.orders.filter((order) => isWithinRange(order.received_at, dateFrom, dateTo)).length;
  const rangeOrdersDelivered = snapshot.orders.filter((order) => isWithinRange(order.delivered_at, dateFrom, dateTo)).length;
  const rangeCalls = snapshot.contactLogs.filter(
    (log) => log.action_type === "call" && isWithinRange(log.created_at, dateFrom, dateTo)
  ).length;
  const rangeWhatsApp = snapshot.contactLogs.filter(
    (log) => log.action_type === "whatsapp" && isWithinRange(log.created_at, dateFrom, dateTo)
  ).length;

  const activeVisitors = snapshot.visitorLogs.filter(
    (log) => log.entry_at && !log.exit_at && !log.no_entry_at
  ).length;
  const activeResidents = snapshot.residentLogs.filter((log) => log.entry_at && !log.exit_at).length;
  const pendingAnnouncements = snapshot.visitorLogs.filter(
    (log) => log.announced_at && !log.entry_at && !log.exit_at && !log.no_entry_at
  ).length;
  const openOrders = snapshot.orders.filter((order) => order.status !== "delivered").length;
  const currentAlerts =
    snapshot.visitorLogs.filter((log) => log.entry_missing).length +
    snapshot.residentLogs.filter((log) => log.entry_missing).length;

  return {
    totals: {
      rangeVisitorEntries,
      rangeVisitorExits,
      rangeResidentEntries,
      rangeResidentExits,
      rangeVisitorNoEntry,
      rangeAlerts,
      rangeOrdersReceived,
      rangeOrdersDelivered,
      rangeCalls,
      rangeWhatsApp,
      activeVisitors,
      activeResidents,
      pendingAnnouncements,
      openOrders,
      currentAlerts,
    },
    trafficSeries: buildTrafficSeries({
      visitorLogs: snapshot.visitorLogs,
      residentLogs: snapshot.residentLogs,
      dateFrom,
      dateTo,
      granularity,
    }),
    statusBreakdown: {
      labels: [
        "Residentes dentro",
        "Visitantes dentro",
        "Anuncios pendientes",
        "Pedidos activos",
        "Alertas actuales",
      ],
      values: [activeResidents, activeVisitors, pendingAnnouncements, openOrders, currentAlerts],
    },
  };
}
