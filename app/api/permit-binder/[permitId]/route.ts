import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  downloadFromStorage,
  isStoragePath
} from "@/lib/supabase-storage";

// Block 41 — 1-Click Digital Binder.
//
// GET /api/permit-binder/<permitId>
//
// Bundles every active Document on a permit into a single .zip and
// streams it back as `application/zip` with a download disposition.
// The municipality clerk (and Bat-Or who submits to them) gets one
// archive with clearly-named files instead of clicking 50 signed URLs.
//
// Authorization mirrors the rest of the permit boundary:
//   * ADMIN / EMPLOYEE — full access.
//   * CONTRACTOR — gated by PortalAccess to the permit's client.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bundling 30+ PDFs can take 20–40 s on cold start; bump above the
// default 10 s Hobby ceiling. Vercel will cap at the plan limit anyway.
export const maxDuration = 60;

// Sanitize a string for use as a filename: strip path separators,
// collapse whitespace, replace illegal Windows characters. We keep
// Hebrew + Latin chars; the modern Windows / macOS / municipality
// clerks all open Hebrew-named files cleanly inside ZIPs.
function safeFilenamePart(s: string, max = 60): string {
  return s
    .replace(/[\\/:*?"<>|\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max) || "ללא שם";
}

// Pull the extension off the original filename so the clerk sees
// "[task] - [doc].pdf" rather than just "[task] - [doc]".
function splitExtension(name: string): { stem: string; ext: string } {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { stem: name, ext: "" };
  }
  return {
    stem: name.slice(0, lastDot),
    ext: name.slice(lastDot) // includes the dot
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ permitId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = session.user.id;
    const role = session.user.role;

    const { permitId } = await context.params;
    if (!permitId) {
      return NextResponse.json({ error: "Missing permitId" }, { status: 400 });
    }

    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: {
        id: true,
        name: true,
        permitNumber: true,
        masterDeal: { select: { clientId: true, client: { select: { companyName: true } } } }
      }
    });
    if (!permit) {
      return NextResponse.json({ error: "ההיתר לא נמצא" }, { status: 404 });
    }

    // CONTRACTOR access gate — staff bypass.
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      if (role !== "CONTRACTOR") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const granted = await prisma.portalAccess.findFirst({
        where: { userId, clientId: permit.masterDeal.clientId },
        select: { id: true }
      });
      if (!granted) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const docs = await prisma.document.findMany({
      where: { permitId, deletedAt: null },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        task: { select: { name: true, category: true } }
      },
      orderBy: [
        // Group by category, then by task name, then by upload time so
        // the ZIP contents are predictable and a clerk scanning the list
        // can find a category quickly.
        { task: { category: { sort: "asc", nulls: "last" } } },
        { task: { name: "asc" } },
        { createdAt: "asc" }
      ]
    });

    const zip = new JSZip();

    // Manifest TXT — a one-page printable index in case the clerk wants
    // a checklist of what's inside. Generated even when there are no
    // files, so the ZIP is never empty.
    const manifestLines: string[] = [];
    manifestLines.push(`רשימת מסמכים — ${permit.name}`);
    manifestLines.push(`לקוח: ${permit.masterDeal.client.companyName}`);
    if (permit.permitNumber) {
      manifestLines.push(`מס׳ היתר: ${permit.permitNumber}`);
    }
    manifestLines.push(`הופק: ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`);
    manifestLines.push("");
    manifestLines.push(`סה״כ מסמכים: ${docs.length}`);
    manifestLines.push("=".repeat(60));
    manifestLines.push("");

    // Used to dedupe filename collisions inside the same folder.
    const seenNamesPerFolder = new Map<string, Map<string, number>>();

    let included = 0;
    let skipped = 0;

    for (const doc of docs) {
      // Folder = category (or "ללא קטגוריה" fallback). Keeps a
      // bureaucratic-folder feel a clerk recognizes.
      const folder = safeFilenamePart(doc.task?.category ?? "ללא קטגוריה", 40);
      const taskPart = doc.task ? safeFilenamePart(doc.task.name, 50) : null;
      const { stem, ext } = splitExtension(doc.fileName);
      const docPart = safeFilenamePart(stem, 50);

      const baseName = taskPart ? `${taskPart} - ${docPart}${ext}` : `${docPart}${ext}`;

      // Dedupe — "X.pdf", "X (2).pdf", "X (3).pdf" within the same folder.
      const folderMap =
        seenNamesPerFolder.get(folder) ?? new Map<string, number>();
      const usedCount = folderMap.get(baseName) ?? 0;
      const finalName =
        usedCount === 0
          ? baseName
          : (() => {
              const { stem: s, ext: e } = splitExtension(baseName);
              return `${s} (${usedCount + 1})${e}`;
            })();
      folderMap.set(baseName, usedCount + 1);
      seenNamesPerFolder.set(folder, folderMap);

      // Pull bytes. Storage-path files come from Supabase; legacy seed
      // rows with absolute URLs are added to the manifest as
      // "external — not bundled" rather than skipped silently.
      if (!isStoragePath(doc.fileUrl)) {
        manifestLines.push(`[חיצוני — לא נכלל בקלסר] ${folder}/${finalName}`);
        manifestLines.push(`    URL: ${doc.fileUrl}`);
        skipped += 1;
        continue;
      }

      try {
        const buf = await downloadFromStorage(doc.fileUrl);
        zip.file(`${folder}/${finalName}`, buf);
        manifestLines.push(`${folder}/${finalName}`);
        included += 1;
      } catch (e) {
        manifestLines.push(`[נכשלה הורדה] ${folder}/${finalName}`);
        manifestLines.push(`    ${e instanceof Error ? e.message : "unknown error"}`);
        skipped += 1;
      }
    }

    manifestLines.push("");
    manifestLines.push("=".repeat(60));
    manifestLines.push(`נכללו בקלסר: ${included} · לא נכללו: ${skipped}`);
    // Manifest goes at the root so the clerk sees it first on the
    // typical "by name" sort in Windows Explorer.
    zip.file(
      "_רשימת מסמכים.txt",
      // BOM so Notepad on Windows picks up the UTF-8 + Hebrew correctly.
      "﻿" + manifestLines.join("\r\n")
    );

    const arrayBuf = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    const hebrewName = `קלסר ${permit.name}.zip`;
    const asciiName = `permit-${permitId.slice(-8)}-binder.zip`;

    return new NextResponse(arrayBuf, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(arrayBuf.byteLength),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(hebrewName)}`,
        // Custom header the client uses to show "30/30 included".
        "X-Binder-Total": String(docs.length),
        "X-Binder-Included": String(included),
        "X-Binder-Skipped": String(skipped),
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("permit-binder generation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Binder generation failed" },
      { status: 500 }
    );
  }
}
