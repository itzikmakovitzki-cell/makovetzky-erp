import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — for server-side use only. Bypasses RLS.
// Never import this from a Client Component.
let _admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env."
    );
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return _admin;
}

export const STORAGE_BUCKET = "permit-documents";
const SIGNED_URL_TTL_SECONDS = 3600; // 1 hour — re-fetched on each page render

export function buildPermitStoragePath(permitId: string, fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `permits/${permitId}/${ts}-${rand}-${safe}`;
}

export function buildProposalStoragePath(
  proposalId: string,
  kind: "signed" | "preview"
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `proposals/${proposalId}/${kind}-${ts}-${rand}.pdf`;
}

// Path for files we upload before forwarding the signed URL to Green API
// for outbound WhatsApp media. Lives under the same bucket as the rest of
// the documents so signed-URL plumbing is uniform.
export function buildWhatsAppOutgoingStoragePath(
  masterDealId: string,
  fileName: string
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `whatsapp-outgoing/${masterDealId}/${ts}-${rand}-${safe}`;
}

export function buildPendingStoragePath(fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `pending/${ts}-${rand}-${safe}`;
}

// Block 30 polish: supplier logos live under their own prefix so the
// /portal/partners grid can cheaply enumerate logos without scanning the
// rest of the document tree. Same bucket as the rest — RLS isn't a worry
// because admin-only writes + signed-URL reads at render time.
export function buildSupplierLogoStoragePath(supplierId: string, fileName: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `suppliers/${supplierId}/logo-${ts}-${rand}-${safe}`;
}

// Block 38: general supplier documents (service catalogs, contracts,
// rate sheets). Separate subdirectory from logo so the partners grid can
// keep enumerating only `suppliers/<id>/logo-*` without touching docs.
export function buildSupplierDocumentStoragePath(
  supplierId: string,
  fileName: string
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safe = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `suppliers/${supplierId}/docs/${ts}-${rand}-${safe}`;
}

export async function uploadToStorage(
  buffer: ArrayBuffer | Uint8Array,
  path: string,
  contentType: string | null | undefined
): Promise<void> {
  const supabase = adminClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: contentType || "application/octet-stream",
    upsert: false
  });
  if (error) throw new Error(`העלאת קובץ לאחסון נכשלה: ${error.message}`);
}

export async function createSignedUrl(
  path: string,
  expiresInSeconds = SIGNED_URL_TTL_SECONDS
): Promise<string> {
  const supabase = adminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`יצירת signed URL נכשלה: ${error.message}`);
  return data.signedUrl;
}

// Best-effort batch; errors are swallowed since URL generation is non-critical
// and individual failures shouldn't break list rendering.
export async function createSignedUrlsSafe(
  paths: string[],
  expiresInSeconds = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  const supabase = adminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) return map;
  for (const item of data) {
    if (item.path && item.signedUrl) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

export async function deleteFromStorage(path: string): Promise<void> {
  const supabase = adminClient();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) throw new Error(`מחיקת קובץ מאחסון נכשלה: ${error.message}`);
}

// Block 41 — direct buffer download for server-side bundling (the binder
// ZIP generator). Bypasses signed URLs since we're inside the same Node
// process; saves the round-trip + the TTL guarantee.
export async function downloadFromStorage(path: string): Promise<ArrayBuffer> {
  const supabase = adminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`הורדת קובץ מאחסון נכשלה: ${error?.message ?? "unknown"}`);
  }
  return await data.arrayBuffer();
}

// Heuristic: in Mock mode, fileUrl is a full URL. In real Storage mode, it's a path
// like "permits/<id>/<ts>-<filename>". This lets us keep legacy seed data working.
export function isStoragePath(fileUrl: string): boolean {
  return !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://");
}
