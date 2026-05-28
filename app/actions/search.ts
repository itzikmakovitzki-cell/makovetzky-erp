"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

// Block 25: powers the global ⌘K command palette. Searches the three top-level
// navigable entities (clients, permits, projects) by name / number and returns
// a flat, ready-to-render result list with destination hrefs.
export type SearchResult = {
  type: "client" | "permit" | "project";
  id: string;
  label: string;
  sublabel: string | null;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchResult[]> {
  await getCurrentUser(); // defense in depth — only authenticated users may search
  const q = query.trim();
  if (q.length < 2) return [];

  const [clients, permits, deals] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, companyName: { contains: q, mode: "insensitive" } },
      select: { id: true, companyName: true, contactName: true },
      take: 6,
      orderBy: { companyName: "asc" }
    }),
    prisma.permit.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { permitNumber: { contains: q, mode: "insensitive" } }
        ]
      },
      select: {
        id: true,
        name: true,
        permitNumber: true,
        masterDeal: { select: { client: { select: { companyName: true } } } }
      },
      take: 6,
      orderBy: { createdAt: "desc" }
    }),
    prisma.masterDeal.findMany({
      where: { deletedAt: null, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, client: { select: { companyName: true } } },
      take: 6,
      orderBy: { createdAt: "desc" }
    })
  ]);

  const results: SearchResult[] = [];
  for (const c of clients) {
    results.push({
      type: "client",
      id: c.id,
      label: c.companyName,
      sublabel: c.contactName,
      href: `/clients/${c.id}`
    });
  }
  for (const p of permits) {
    const sub = [p.permitNumber, p.masterDeal.client.companyName].filter(Boolean).join(" · ");
    results.push({
      type: "permit",
      id: p.id,
      label: p.name,
      sublabel: sub || null,
      href: `/permits/${p.id}/tasks`
    });
  }
  for (const d of deals) {
    results.push({
      type: "project",
      id: d.id,
      label: d.name,
      sublabel: d.client.companyName,
      href: `/projects/${d.id}`
    });
  }
  return results;
}
