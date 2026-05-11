import { fetchVisitorAccessLogs } from "./visitors.repository.js";

export async function fetchDashboardLogs(dateFrom, dateTo) {
  return fetchVisitorAccessLogs({
    dateFrom,
    dateTo,
  });
}

