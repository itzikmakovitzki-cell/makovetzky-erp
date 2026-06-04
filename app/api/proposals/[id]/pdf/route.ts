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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mode = req.nextUrl.searchParams.get("mode") === "signed" ? "signed" : "preview";

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
      milestones,
      createdAt: proposal.createdAt
    },
    { mode: "preview" }
  );

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
