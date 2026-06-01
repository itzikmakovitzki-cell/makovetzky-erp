# Spec — WhatsApp Groups per Project

**Status:** draft, awaiting review
**Owner:** Bat-Or (PM) + admin (Ofir)
**Builds on:** Block 8c (inbound webhook), PR #52 (client opt-in), PR #53 (Green API outbound)
**Replaces:** —
**Last update:** 2026-06-01

---

## 1. Goal in one sentence

Every project (`MasterDeal`) already has its own WhatsApp group in real life. We want the system to plug into that group: ingest files sent there (when tagged), route outbound updates there by default, and surface a per-client history pane that shows the whole conversation (both directions) — without changing the strict rule that the system never auto-sends.

---

## 2. User stories

1. **As Ofir,** I want to connect the system's WhatsApp number to a project's existing group, so the group becomes the project's communication channel.
2. **As anyone in the group** (architect, contractor, client, surveyor), I want to send a file by tagging the system's number — and have that file appear inside the project's "pending documents" inbox automatically.
3. **As the file sender,** I want to write the form's name in the message caption — so the file is saved with that name in the system (not a generic timestamp).
4. **As Ofir,** when I press "send update" on a project, the message should go to the group by default — that's where everyone sees it. If I explicitly want to message the client privately instead, I can pick that.
5. **As Bat-Or,** I want a single "WhatsApp" screen per project where I see the full chronological history — what the group sent in, what we sent out — without hunting through audit logs.

---

## 3. Data model

### 3.1 New: `ProjectWhatsAppGroup`

```prisma
model ProjectWhatsAppGroup {
  id            String   @id @default(cuid())
  masterDealId  String   @unique   // 1:1 — one project, one group, for now
  groupChatId   String              // Green API chatId, e.g. "972501234567-1638123456@g.us"
  groupName     String?             // cached display name from Green API (refresh on inbound webhook)
  connectedAt   DateTime @default(now())
  connectedById String?
  isActive      Boolean  @default(true)
  // When a group sends a message but isn't yet linked to a project, we
  // hold the groupChatId in this table with masterDealId = null (or in a
  // separate PendingGroup table — decide in §10).
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  masterDeal    MasterDeal @relation(fields: [masterDealId], references: [id], onDelete: Cascade)
  connectedBy   User?      @relation(fields: [connectedById], references: [id], onDelete: SetNull)

  @@index([groupChatId])
  @@index([isActive])
}

model MasterDeal {
  // ... existing fields ...
  whatsappGroup ProjectWhatsAppGroup?
}
```

Open question (§10): should `groupChatId` be `@unique`? Probably yes — one WhatsApp group can belong to at most one project. Helps catch double-linking.

### 3.2 Modified: `Client.notificationPreference`

Current values: `OFF` / `MANUAL_ONLY`. We don't change them — they control whether the **client-direct** path is even allowed on the client profile. The new "group send" path is governed by the **project**, not the client, so a different field on `MasterDeal`:

```prisma
enum WhatsAppDefaultRoute {
  GROUP            // default destination for "send update" buttons
  CLIENT_DIRECT    // legacy / projects without a group
  NONE             // no outbound for this project (mirrors Client.OFF)
}

model MasterDeal {
  // ... existing fields ...
  whatsappDefaultRoute WhatsAppDefaultRoute @default(GROUP)
}
```

When `whatsappDefaultRoute = GROUP`:
- Compose dialog's primary button = "📤 שלח לקבוצה"
- Secondary option (overflow menu): "📤 שלח ישירות ללקוח (פרטי)" — appears only if `Client.notificationPreference = MANUAL_ONLY`

When `whatsappDefaultRoute = CLIENT_DIRECT`:
- Current PR #52 / PR #53 behaviour.

When `whatsappDefaultRoute = NONE`:
- Button hidden entirely, like `Client.OFF`.

### 3.3 New optional column on `PendingDocument`

```prisma
model PendingDocument {
  // ... existing fields ...
  groupChatId      String?     // when ingested from a group mention, the source group
  authorName       String?     // sender's name in the group (from Green API webhook)
  authorPhone      String?     // sender's phone (already partly captured in senderInfo today)
  suggestedTaskName String?    // parsed from the message caption — see §4.2
}
```

Existing `senderInfo` + `sourceChannel` stay as-is.

### 3.4 New: outbound message log (optional, §10)

Currently outbound sends only live in `AuditLog`. The history panel (§7) reads them from there. If queries become slow at scale we can mirror to a dedicated `ClientWhatsAppMessage` table later; not in MVP.

---

## 4. Inbound flow — group → system

### 4.1 Trigger condition

A message arrives at our Green API webhook with `chatId` ending in `@g.us` (group) AND one of:
- the system's WhatsApp number is mentioned in the message text (`@972XXXXXXXXX`)
- the message is a reply-to (`quotedMessage`) of any system message
- OR (configurable per-group) **any** file in the group is ingested

For MVP: **only** mentions + reply-to. The "any file" mode is a per-group toggle for later, to avoid accidentally sucking up everything.

### 4.2 Parsing rules

Caption format examples (informal — the parser is permissive):

```
@מקובצקי טופס 4 חתום
```
→ `suggestedTaskName = "טופס 4 חתום"`

```
@מקובצקי
```
→ no suggested name; file gets the default timestamped filename.

```
@מקובצקי אישור גינון - מהנדס יואב
```
→ `suggestedTaskName = "אישור גינון - מהנדס יואב"`

The mention prefix (`@מקובצקי` or `@972…`) is stripped; whatever follows is the name. Trailing newlines / extra spaces are trimmed.

### 4.3 What happens after parsing

1. New `PendingDocument` row created:
   - `sourceChannel = WHATSAPP`
   - `groupChatId = <the group>`
   - `assignedPermitId` = inferred from the project linked to the group (auto-populated since the group is project-bound)
   - `suggestedTaskName` = parsed name
   - `authorName` / `authorPhone` from Green API webhook
   - `fileUrl` from existing Block 8c flow (download + put in Supabase Storage)
2. The `/inbox` already shows it, but it now displays grouped by project + with the suggested task name visible.
3. Admin still does the final assignment (which task in the project gets the file) — same as today. The auto-populated `assignedPermitId` just saves a click.

### 4.4 Unmatched group fallback

If a group sends a message before it's been linked to a project:
- Record the `groupChatId` in `ProjectWhatsAppGroup` with `masterDealId = null` (or a separate `OrphanWhatsAppGroup` table — §10).
- The `/settings/whatsapp` page shows "Pending Groups" — admin links each one to a project from a dropdown.
- Until linked, files from that group are ingested but `assignedPermitId = null` (they sit in `/inbox` like any other untagged message).

---

## 5. Outbound flow — system → group

### 5.1 New action: `sendProjectGroupMessage`

```typescript
sendProjectGroupMessage({
  masterDealId: string,
  message: string,
}): Promise<
  | { ok: true; via: "green-api"; idMessage: string }
  | { ok: true; via: "wa-me"; waUrl: string }  // group wa.me links don't work the same — see §10
  | { ok: false; error: string }
>
```

Identical structure to `sendClientWhatsAppMessage` (PR #53), but the recipient is the group's `groupChatId` instead of a personal phone. Green API supports group sends with the same endpoint:

```
POST /waInstance{idInstance}/sendMessage/{apiTokenInstance}
body: { chatId: "972…@g.us", message: "..." }
```

### 5.2 UI integration

On the project detail page (`/projects/[id]`) — new "תקשורת — WhatsApp" panel (mirrors the one on `/clients/[id]`):
- Status pill: "מחובר לקבוצה: <group name>" / "לא מחובר — חבר עכשיו" / "כבוי"
- "📤 שלח לקבוצה" button (primary)
- "📤 שלח ישירות ללקוח" (secondary, only if `Client.notificationPreference = MANUAL_ONLY`) — pops the existing client compose dialog

### 5.3 The default-route confusion

Today the client profile has its own send panel. After this spec lands, there's overlap:
- The same Send action exists on the client AND the project.
- Both can produce the same outcome (a message goes to either group or client).

Recommended resolution:
- **Client profile** keeps its panel **only** for the rare "private message to client" case.
- **Project profile** becomes the primary place. The client panel adds a discreet "fall back to private send" toggle.

---

## 6. The new screen — `/projects/[id]/whatsapp`

A dedicated tab on the project detail layout, alongside the existing tabs (overview, permits, finances). Three sections:

### 6.1 Section A — Connection status

- "מחובר לקבוצה: כהן שיפוצים — דירת רובינא" (cached `groupName`)
- "כתובת הקבוצה: 972…-1638…@g.us"
- "מחובר מאז: 28.05.26 ע״י אופיר"
- Buttons: "בטל חיבור" / "חבר קבוצה אחרת"

If not connected: a "חבר קבוצה" wizard:
1. Tell the user to send a WhatsApp message in the project group that mentions the system's number, OR add the system's number to the group.
2. The system shows pending groups (the orphan list) and the admin picks the right one.

### 6.2 Section B — Outbound

Compose dialog identical to PR #53's client send dialog, but:
- Target = group
- Confirmation dialog text: "לשלוח את ההודעה לקבוצה X? כולם בקבוצה יקבלו אותה."

### 6.3 Section C — History

This is the panel I (Claude) offered earlier. Combined timeline of:

1. **Outbound** — from `AuditLog` filtered to `entityType = CLIENT|MASTER_DEAL`, with `newValue->>'event' LIKE 'whatsapp_%'` AND project matches.
2. **Inbound** — `PendingDocument` rows where `groupChatId = <this group>` OR `senderInfo` matches the client's phone.
3. Sorted descending by time. Each row shows:
   - Direction (← incoming / → outgoing)
   - Author (name + phone for group; "המערכת ע״י ofir" for outgoing)
   - Body (message text, or filename + thumbnail for media)
   - Status badges: "נשלח", "אושר", "תויג למשימה X" (for incoming files)
   - Click row → drill-down (the original audit row OR the document detail)

Pagination same as `/settings/audit-log` (50 per page, URL-encoded).

---

## 7. Architecture decision: is the system in **one** WhatsApp number or **many**?

Today: one number (`GREEN_API_ID_INSTANCE` / `GREEN_API_TOKEN_INSTANCE` env vars on Vercel).

For this spec: same number. The same WhatsApp account is in all project groups.

Implications:
- The same number receives messages from all groups. Group context lives in the `chatId` of the webhook.
- Easier to manage one Green API instance billing-wise.
- Slight privacy issue: if Ofir personally uses the same number, his personal chats interleave with project ones. **Recommendation:** dedicate a separate WhatsApp number to the system (and document it in `reference_makovetzky_resources.md`).

If the user wants per-project numbers later, the schema (`ProjectWhatsAppGroup.groupChatId` + a future `instanceId` column) supports it without a migration redo.

---

## 8. Phasing recommendation

Three PRs, mergeable independently:

### PR-1 (small, no Green API required): History panel on client profile
- Pure read-only. Just renders `AuditLog` rows scoped to the client + matched `PendingDocument` rows by phone.
- Useful immediately, even without group integration.
- Surfaces value of the new screen approach without committing schema yet.

### PR-2 (medium, requires Green API + dedicated number): Group linking + outbound
- New `ProjectWhatsAppGroup` model + migration.
- New `/projects/[id]/whatsapp` screen with sections A + B (connection + outbound).
- New `sendProjectGroupMessage` action.
- Default route on `MasterDeal` (`GROUP` / `CLIENT_DIRECT` / `NONE`).

### PR-3 (medium, depends on PR-2): Inbound parsing + history union
- Webhook update: parse mentions, save `suggestedTaskName`, auto-tag `assignedPermitId`.
- Section C of the new screen (combined inbound/outbound timeline per project).
- Optionally fold the client-profile history panel from PR-1 into a project view.

---

## 9. Non-goals (explicitly out of scope)

- **Sending media (images/PDFs) from the system to a group.** Outbound is text-only for MVP. Green API supports media sends but we don't wire that until Ofir asks.
- **Multi-instance support.** One Green API number for the whole company.
- **WhatsApp Business API (Meta direct).** Green API stays the transport. The `Block 8c` webhook is the only inbound path.
- **Auto-classifying inbound files** to specific tasks. The admin still does the final task assignment in `/inbox`. We only auto-populate the project.
- **Bidirectional sync to a chat app inside our UI.** This is not WhatsApp Web. We surface metadata, not a live chat experience.
- **Scheduled/automatic outbound messages.** The hard rule from PR #52 stands: every send is admin-initiated.

---

## 10. Open questions before implementation

1. **One group per project, or many?** Spec assumes 1:1. If a project has both a "client coordination" group and a "contractors" group, we'd need to loosen this to a list. (Recommendation: ship 1:1, refactor if needed.)
2. **Orphan groups storage.** Same table with nullable `masterDealId`, or a separate `OrphanWhatsAppGroup`? (Recommendation: same table, nullable — simpler.)
3. **wa.me fallback for groups.** wa.me deep links work for personal numbers but **don't open group chats** the same way. If Green API is unconfigured or fails, what's the group-send fallback? (Likely answer: just show an error — there's no graceful fallback for groups. The user can still copy the text and paste it into WhatsApp manually.)
4. **Should the history panel include the existing "Block 25 internal team WhatsApp" reminders?** Those are sent to assignees (internal team), not clients/groups. Probably keep them out of the project-WhatsApp history; they belong to the audit log only.
5. **Privacy on the client profile.** If the project default route is `GROUP`, do we hide the client profile's "send update" button entirely, or keep it as the "private override"? (Recommendation: keep as override but visually de-emphasised.)
6. **Mention detection.** Does the Green API webhook expose mentions cleanly? Need to inspect a real payload from a group message with a `@number` mention. **Action item before PR-3:** capture one real example.
7. **Magic keyword fallback.** If the system's number isn't mentioned but the message starts with a magic keyword (e.g. "מקובצקי") followed by a file, do we still ingest? (Recommendation: yes — increases robustness when users forget the @.)
8. **Trigger on edit/delete of group messages.** Green API webhook delivers edits and deletes too. For MVP we ignore both; PendingDocument rows are append-only.

---

## 11. Migration / data impact

- New model `ProjectWhatsAppGroup` — empty initially.
- `MasterDeal.whatsappDefaultRoute` defaults to `GROUP`. **Risk:** existing projects (Hana Rovina, Sapir Ariel, Ushishkin 39) would suddenly have group as the default routing, BUT they have no group connected yet — so the compose button would be greyed out with "לא מחובר לקבוצה" until linked. No data corruption; just a UI dead-end until the admin connects a group.
- Existing client `notificationPreference` values untouched.
- Migration 015 (or whatever's next).

---

## 12. Estimate

- **PR-1 (history panel only):** ~3-4 hours. Pure render of existing data.
- **PR-2 (group linking + outbound):** ~6-8 hours including schema + new screen + dialog wiring.
- **PR-3 (inbound parsing + combined timeline):** ~6-8 hours including webhook update + parser + timeline UI.

Total feature: ~15-20 hours over 3 PRs. Each independently usable.

---

## Approval checklist before coding

- [ ] Confirm 1:1 (one group per project) is the right starting model
- [ ] Confirm a dedicated WhatsApp number for the system (not Ofir's personal)
- [ ] Confirm the default route is `GROUP` (not `CLIENT_DIRECT`) for new projects
- [ ] Pick the phasing order — PR-1 first feels right, but if "send to group" is the higher-pain item we can flip and do PR-2 first
- [ ] Decide on the orphan groups table approach (§10 #2)
- [ ] Capture one real Green API group-mention webhook payload (§10 #6) before starting PR-3
