import { prisma } from "@/lib/prisma";

// Authorization layer for the /portal namespace.
//
// External users (CONTRACTOR role today; would also cover a future CLIENT
// role) see only the permits whose MasterDeal.clientId is granted to them
// via the PortalAccess table. Admins are not restricted — they can preview
// any permit to support customers.
//
// We do NOT trust anything from the JWT for this — clientIds are not in the
// session token and could become stale even if they were. Always query
// PortalAccess fresh.

export type PortalScope =
  | { kind: "admin"; allClients: true }
  | { kind: "scoped"; clientIds: string[] };

export async function getPortalScope(user: { id: string; role: string }): Promise<PortalScope> {
  if (user.role === "ADMIN") return { kind: "admin", allClients: true };
  const accesses = await prisma.portalAccess.findMany({
    where: { userId: user.id },
    select: { clientId: true }
  });
  return { kind: "scoped", clientIds: accesses.map((a) => a.clientId) };
}

// Used as a Prisma `where` fragment to limit permits to those the user can
// see. Returns `undefined` when admin (no restriction). The caller spreads
// this into a broader `where` clause.
export function permitClientFilter(scope: PortalScope) {
  if (scope.kind === "admin") return {};
  return {
    masterDeal: {
      clientId: { in: scope.clientIds }
    }
  } as const;
}

// Throws if the user does not have access to this permit. Use before any
// portal action that mutates data (uploads etc.).
export async function assertPortalAccessToPermit(
  user: { id: string; role: string },
  permitId: string
): Promise<{ permitId: string; clientId: string }> {
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true, masterDeal: { select: { clientId: true } } }
  });
  if (!permit) throw new Error("ההיתר לא נמצא");

  if (user.role === "ADMIN") {
    return { permitId: permit.id, clientId: permit.masterDeal.clientId };
  }
  const granted = await prisma.portalAccess.findFirst({
    where: { userId: user.id, clientId: permit.masterDeal.clientId },
    select: { id: true }
  });
  if (!granted) throw new Error("אין לך גישה להיתר זה");
  return { permitId: permit.id, clientId: permit.masterDeal.clientId };
}
