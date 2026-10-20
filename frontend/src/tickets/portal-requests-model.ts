import type { PortalTechRequest } from '../api/tickets-portal-requests';

export interface VendorRequestGroup {
  vendor: { id: string; name: string };
  requests: PortalTechRequest[];
}

/** Pending technician requests grouped by vendor company: groups ordered by name, requests inside a group keep the server's order. */
export function groupByVendor(requests: readonly PortalTechRequest[]): VendorRequestGroup[] {
  const groups = new Map<string, VendorRequestGroup>();
  for (const r of requests) {
    let g = groups.get(r.vendor.id);
    if (!g) groups.set(r.vendor.id, (g = { vendor: r.vendor, requests: [] }));
    g.requests.push(r);
  }
  return [...groups.values()].sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));
}
