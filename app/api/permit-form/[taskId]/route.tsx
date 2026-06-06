import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  PermitFormDocument,
  type PermitFormData
} from "@/lib/pdf/permit-form";

// Block 40 — auto-filled permit form generator.
//
// GET /api/permit-form/<taskId>
//
// Authentication:
//   * ADMIN / EMPLOYEE — full access.
//   * CONTRACTOR — gated by PortalAccess to the task's permit's client.
//   * Anyone else → 401.
//
// We use a Node.js runtime (not Edge) because @react-pdf/renderer
// depends on `fs` (we read the bundled Heebo TTFs from public/fonts/).
// The route returns the PDF as a stream with `Content-Disposition:
// attachment` so the browser triggers a save dialog instead of opening
// the PDF inline.

export const runtime = "nodejs";
// Always fetch the latest task data — these forms are filled out the
// moment they're generated, no cache benefit from staleness.
export const dynamic = "force-dynamic";

// Slugify the permit name down to filesystem-safe ASCII; Hebrew filenames
// confuse some browsers' download dialogs, so we encode the Hebrew name
// via RFC 5987 in the Content-Disposition header (filename*=UTF-8'').
function asciiFallback(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "permit-form";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = session.user.id;
    const role = session.user.role;

    const { taskId } = await context.params;
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        permit: {
          select: {
            id: true,
            name: true,
            permitNumber: true,
            authority: { select: { name: true } },
            buildings: {
              select: { label: true, address: true }
            },
            masterDeal: {
              select: {
                clientId: true,
                client: {
                  select: {
                    companyName: true,
                    contactName: true,
                    phone: true,
                    address: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!task) {
      return NextResponse.json({ error: "המשימה לא נמצאה" }, { status: 404 });
    }

    // CONTRACTOR access gate via PortalAccess — staff bypass.
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      if (role !== "CONTRACTOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const granted = await prisma.portalAccess.findFirst({
        where: { userId, clientId: task.permit.masterDeal.clientId },
        select: { id: true }
      });
      if (!granted) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const data: PermitFormData = {
      permit: {
        name: task.permit.name,
        permitNumber: task.permit.permitNumber,
        // gush / helka aren't on the schema yet — render as blank
        // fillable lines in the PDF. Future migration will populate them.
        gush: null,
        helka: null,
        authorityName: task.permit.authority.name
      },
      client: {
        companyName: task.permit.masterDeal.client.companyName,
        contactName: task.permit.masterDeal.client.contactName,
        phone: task.permit.masterDeal.client.phone,
        address: task.permit.masterDeal.client.address
      },
      buildings: task.permit.buildings.map((b) => ({
        label: b.label,
        address: b.address
      })),
      task: {
        name: task.name,
        category: task.category,
        description: task.description
      },
      generatedAt: new Date(),
      generatedBy: session.user.name || session.user.email || "מערכת"
    };

    const buffer = await renderToBuffer(<PermitFormDocument data={data} />);
    // Buffer → Uint8Array so it's a valid BodyInit for NextResponse.
    const body = new Uint8Array(buffer);

    const hebrewName = `טופס דיווח - ${task.permit.name} - ${task.name}.pdf`;
    const asciiName = `${asciiFallback(task.permit.name)}-${asciiFallback(task.name)}.pdf`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(body.byteLength),
        // RFC 5987: filename= holds the ASCII fallback for legacy UAs,
        // filename*= holds the percent-encoded UTF-8 for modern ones.
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(hebrewName)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("permit-form generation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
