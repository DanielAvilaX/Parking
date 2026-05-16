import { fetchContactActionLogs } from "./contact-actions.repository.js";
import { fetchPorterOrders } from "./orders.repository.js";
import { fetchResidentAccessLogs } from "./resident-access.repository.js";
import { fetchVisitorAccessLogs } from "./visitors.repository.js";

export async function fetchDashboardSnapshot() {
  const [visitorLogs, residentLogs, orders, contactLogs] = await Promise.all([
    fetchVisitorAccessLogs(),
    fetchResidentAccessLogs(),
    fetchPorterOrders(),
    fetchContactActionLogs(),
  ]);

  return {
    visitorLogs,
    residentLogs,
    orders,
    contactLogs,
  };
}
