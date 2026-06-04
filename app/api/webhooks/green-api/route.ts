import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPendingStoragePath, uploadToStorage } from "@/lib/supabase-storage";
import {
  deriveGreenApiFileName,
  downloadGreenApiMedia,
  normalizeGreenApiPayload,
  type GreenApiWebhook,
  type NormalizedIncoming
} from "@/lib/green-api";
import {
  isGroupChatId,
  isReplyToSystem,
  parseSystemMention,
  readSystemMentionTokens
} from "@/lib/whatsapp-mentions";

// Green-API.com webhook adapter. Translates their fixed payload format into
// a PendingDocument row (sourceChannel=WHATSAPP), mirroring what the Meta
// Cloud API handler at /api/whatsapp/webhook does — but for the QR-scan flow
// that does not require Meta Business verification.
//
// PR-3 (spec docs/spec-whatsapp-groups.md §4) added group-aware behaviour:
//   • Detect group messages by chatId ending with @g.us.
//   • Upsert ProjectWhatsAppGroup so the group is discoverable even before
//     an admin links it to a project (orphan list on /inbox).
//   • For groups, only INGEST the message as a PendingDocument when it
//     mentions the system number/name (spec §4.1 trigger). Otherwise we
//     just refresh the group name cache and ack — no row.
//   • When ingested, populate groupChatId/authorName/authorPhone and the
//     parsed suggestedTaskName; auto-fill assignedPermitId from the
//     project's most recent active permit when known.
//
// Auth: Green API webhooks have no built-in signature. We require the same
// WHATSAPP_WEBHOOK_SECRET used by /api/webhooks/whatsapp, accepted either as
// X-Webhook-Secret header or ?secret= query param. Configure the secret in
// the URL when pasting it into Green API's "outgoingMessageWebhook" field.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_PREVIEW_LIMIT = 4000;

// Ensures a ProjectWhatsAppGroup row exists for the given group chatId.
// Refreshes the cached groupName on every webhook so display stays current
// without an extra Green-API call. Returns the row (with masterDealId) so
// the caller can auto-fill assignedPermitId for ingested rows.
async function upsertGroupRow(args: {
  groupChatId: string;
  groupName: string | null;
}) {
  return prisma.projectWhatsAppGroup.upsert({
    where: { groupChatId: args.groupChatId },
    create: {
      groupChatId: args.groupChatId,
      groupName: args.groupName,
      masterDealId: null,
      isActive: true
    },
    update: args.groupName ? { groupName: args.groupName } : {},
    select: {
      id: true,
      masterDealId: true,
      groupChatId: true,
      groupName: true,
      captureAllFiles: true
    }
  });
}

// Picks the permit to auto-tag for an ingested group document. Spec §4.3:
// "assignedPermitId מוסק אוטומטית מהפרויקט שמקושר לקבוצה". A MasterDeal can
// hold several permits; we pick the most-recently-updated active one. If the
// deal has no active permits we leave assignedPermitId null and the row sits
// in /inbox like any other unrouted entry — better than picking a closed
// permit and confusing the admin.
async function pickAutoAssignedPermit(masterDealId: string | null): Promise<string | null> {
  if (!masterDealId) return null;
  const permit = await prisma.permit.findFirst({
    where: {
      masterDealId,
      deletedAt: null,
      status: { in: ["DRAFT", "IN_PROGRESS", "AWAITING_AUTHORITY"] }
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true }
  });
  return permit?.id ?? null;
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Webhook not configured", detail: "WHATSAPP_WEBHOOK_SECRET missing" },
      { status: 503 }
    );
  }
  const providedSecret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: GreenApiWebhook;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized: NormalizedIncoming | null = normalizeGreenApiPayload(payload);
  // Non-inbound events (statuses, outgoing echoes, instance state changes)
  // are acknowledged with 200 so Green API doesn't keep retrying.
  if (!normalized) {
    return NextResponse.json({ ok: true, skipped: payload.typeWebhook ?? "unknown" });
  }

  if (!normalized.fromPhone) {
    return NextResponse.json({ ok: true, skipped: "no_sender" });
  }

  // Idempotency: Green API can redeliver. Tag rawMessage with [green:<id>]
  // and dedupe on subsequent webhooks.
  if (normalized.idMessage) {
    const existing = await prisma.pendingDocument.findFirst({
      where: { rawMessage: { contains: `[green:${normalized.idMessage}]` } },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({ ok: true, dedupe: true, pendingDocumentId: existing.id });
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // PR-3 group path.
  // ────────────────────────────────────────────────────────────────────
  const isGroup = isGroupChatId(normalized.chatId);
  let groupRow: Awaited<ReturnType<typeof upsertGroupRow>> | null = null;
  let mention: { mentioned: boolean; suggestedTaskName: string | null } = {
    mentioned: false,
    suggestedTaskName: null
  };

  if (isGroup && normalized.chatId) {
    // Always refresh / create the group row, even if we won't ingest the
    // message. This is what makes the /inbox orphan list populate.
    groupRow = await upsertGroupRow({
      groupChatId: normalized.chatId,
      groupName: normalized.chatName
    });

    // Spec §4.1 trigger: ingest when EITHER an @mention of the system is in
    // the body OR the user replied to a previous system message. The reply
    // path piggybacks on Green API's `quotedParticipant`, so we can detect it
    // without storing every outbound idMessage server-side.
    //
    // Per-group `captureAllFiles` override (Block 22): when admin has flipped
    // this on for the group, skip the mention check entirely and ingest every
    // message. The suggestedTaskName is intentionally null in that mode —
    // there's no natural language signal saying "this becomes a task".
    const tokens = readSystemMentionTokens();
    const subject = normalized.text ?? normalized.media?.caption ?? "";
    mention = parseSystemMention(subject, tokens);

    if (groupRow.captureAllFiles && !mention.mentioned) {
      mention = { mentioned: true, suggestedTaskName: null };
    }

    if (!mention.mentioned) {
      // Reply-to-system fallback: even without a textual @mention, a reply
      // to a message we sent counts as a trigger. suggestedTaskName stays
      // null (the caption text wasn't aimed at the parser), but the file /
      // message is still ingested.
      if (isReplyToSystem(normalized.quotedParticipant, tokens.phone)) {
        mention = { mentioned: true, suggestedTaskName: null };
      } else {
        return NextResponse.json({
          ok: true,
          group: true,
          groupChatId: normalized.chatId,
          ingested: false,
          reason: "no_system_mention"
        });
      }
    }
  }

  const phoneFormatted = `+${normalized.fromPhone}`;
  const senderInfo = normalized.senderName
    ? `WhatsApp — ${normalized.senderName} (${phoneFormatted})`
    : `WhatsApp — ${phoneFormatted}`;

  const idTag = normalized.idMessage ? `[green:${normalized.idMessage}]` : null;

  // Group-only extras applied uniformly to text / media / unsupported branches.
  const groupExtras: {
    groupChatId: string | null;
    authorName: string | null;
    authorPhone: string | null;
    suggestedTaskName: string | null;
    assignedPermitId: string | null;
  } = {
    groupChatId: null,
    authorName: null,
    authorPhone: null,
    suggestedTaskName: null,
    assignedPermitId: null
  };
  if (isGroup && groupRow) {
    groupExtras.groupChatId = groupRow.groupChatId;
    groupExtras.authorName = normalized.senderName;
    groupExtras.authorPhone = phoneFormatted;
    groupExtras.suggestedTaskName = mention.suggestedTaskName;
    groupExtras.assignedPermitId = await pickAutoAssignedPermit(groupRow.masterDealId);
  }

  try {
    if (normalized.kind === "text") {
      const text = normalized.text ?? "";
      const truncated =
        text.length > MESSAGE_PREVIEW_LIMIT ? text.slice(0, MESSAGE_PREVIEW_LIMIT) + "…" : text;
      const rawMessage = [idTag, truncated].filter(Boolean).join(" ") || idTag;
      const pending = await prisma.pendingDocument.create({
        data: {
          sourceChannel: "WHATSAPP",
          senderInfo,
          fileUrl: "",
          fileName: null,
          mimeType: null,
          rawMessage,
          status: "PENDING",
          ...groupExtras
        }
      });
      return NextResponse.json({
        ok: true,
        pendingDocumentId: pending.id,
        group: isGroup,
        autoAssignedPermitId: groupExtras.assignedPermitId
      });
    }

    if (normalized.kind === "media" && normalized.media) {
      const { buffer, mimeType: headerMime } = await downloadGreenApiMedia(normalized.media.downloadUrl);
      const mimeType = normalized.media.mimeType || headerMime || null;
      const messageType = payload.messageData?.typeMessage ?? "media";
      const fileName = deriveGreenApiFileName(messageType, mimeType, normalized.media.fileName);
      const storagePath = buildPendingStoragePath(fileName);
      await uploadToStorage(buffer, storagePath, mimeType);

      const captionPart = normalized.media.caption
        ? normalized.media.caption.length > MESSAGE_PREVIEW_LIMIT
          ? normalized.media.caption.slice(0, MESSAGE_PREVIEW_LIMIT) + "…"
          : normalized.media.caption
        : null;
      const rawMessage = [idTag, captionPart].filter(Boolean).join(" ") || idTag;

      const pending = await prisma.pendingDocument.create({
        data: {
          sourceChannel: "WHATSAPP",
          senderInfo,
          fileUrl: storagePath,
          fileName,
          mimeType,
          rawMessage,
          status: "PENDING",
          ...groupExtras
        }
      });
      return NextResponse.json({
        ok: true,
        pendingDocumentId: pending.id,
        group: isGroup,
        autoAssignedPermitId: groupExtras.assignedPermitId
      });
    }

    // unsupported kind — log a placeholder row so nothing is silently dropped.
    const note = normalized.reason ?? "(הודעה לא נתמכת)";
    const rawMessage = [idTag, note].filter(Boolean).join(" ");
    const pending = await prisma.pendingDocument.create({
      data: {
        sourceChannel: "WHATSAPP",
        senderInfo,
        fileUrl: "",
        fileName: null,
        mimeType: null,
        rawMessage,
        status: "PENDING",
        ...groupExtras
      }
    });
    return NextResponse.json({
      ok: true,
      pendingDocumentId: pending.id,
      kind: "unsupported",
      group: isGroup
    });
  } catch (err) {
    // Log + 500. Green API will retry, which is what we want for transient
    // storage/database errors.
    console.error("[green-api-webhook] processing failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
