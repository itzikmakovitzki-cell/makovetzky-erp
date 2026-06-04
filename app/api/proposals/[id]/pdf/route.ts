import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProposalHtml,
  renderPdfBuffer,
  type ProposalMilestoneLite
} from "@/lib/proposal-pdf";
import { createSignedUrl } from "@/lib/supabase-storage";

// Heavy serverless function — runs puppeteer.
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

// Public endpoint. Same security model as `/quote/[id]` — the cuid is the
// only secret. V1 proposals never had a PDF, so this route 404s for them.
//
// Modes:
//  - default / `mode=html`    : serve the proposal as A4-styled HTML. Fast,
//    no chromium needed — used by the customer-facing iframe + admin preview.
//  - `mode=pdf`               : try to render a PDF on the fly (chromium).
//  - `mode=signed`            : redirect to the stored signed PDF in storage.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawMode = req.nextUrl.searchParams.get("mode") ?? "html";
  const mode: "html" | "pdf" | "signed" =
    rawMode === "signed"
      ? "signed"
      : rawMode === "pdf"
        ? "pdf"
        : "html";

  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null }
  });
  if (!proposal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (proposal.templateVersion < 2) {
    return NextResponse.json(
      { error: "PDF is not available for legacy proposals" },
      { status: 404 }
    );
  }

  if (mode === "signed") {
    if (!proposal.signedPdfPath) {
      return NextResponse.json(
        { error: "Proposal has not been signed yet" },
        { status: 404 }
      );
    }
    try {
      const url = await createSignedUrl(proposal.signedPdfPath, 600);
      return NextResponse.redirect(url, { status: 302 });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : "failed to sign storage URL"
        },
        { status: 500 }
      );
    }
  }

  const milestones: ProposalMilestoneLite[] = Array.isArray(proposal.milestones)
    ? (proposal.milestones as unknown as ProposalMilestoneLite[])
    : [];

  // Build the HTML once — it's used both for HTML mode and as the source
  // document for PDF rendering.
  const html = buildProposalHtml(
    {
      id: proposal.id,
      quoteTitle: proposal.quoteTitle,
      customerName: proposal.customerName,
      customerPhone: proposal.customerPhone,
      customerEmail: proposal.customerEmail,
      projectLocation: proposal.projectLocation,
      totalAmount: proposal.totalAmount.toString(),
      serviceDescription: proposal.serviceDescription,
      pricesIncludeVat: proposal.pricesIncludeVat,
      milestones,
      createdAt: proposal.createdAt
    },
    { mode: "preview" }
  );

  if (mode === "html") {
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // Allow embedding in our own /quote/[id] page's iframe.
        "X-Frame-Options": "SAMEORIGIN"
      }
    });
  }

  try {
    const buf = await renderPdfBuffer(html);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposal-${proposal.id.slice(
          -6
        )}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "render failed" },
      { status: 500 }
    );
  }
}
