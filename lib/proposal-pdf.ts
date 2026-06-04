// Renders the V2 (branded) proposal as HTML, then to a PDF buffer via
// puppeteer. The HTML mirrors the layout in
// `מקוביצקי ניהול פרוייקטים מיתוג סופי/תבנית_הצעת_מחיר.html` but with the
// content structure from the user's old paper quote (intro / service /
// pricing table / general terms / signature).

import {
  BRAND_TOKENS,
  COMPANY_DETAILS,
  DEFAULT_SERVICE_DESCRIPTION,
  GENERAL_TERMS_BULLETS,
  type ProposalSignaturePayload
} from "./proposal-template";
import { formatDate, formatILS } from "./utils";

export type ProposalMilestoneLite = {
  description: string;
  amount: number;
  dueDate?: string | null;
};

export type ProposalPdfInput = {
  id: string;
  quoteTitle: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  projectLocation: string | null;
  totalAmount: number | string;
  serviceDescription: string | null;
  milestones: ProposalMilestoneLite[];
  createdAt: Date;
};

export type BuildHtmlOptions =
  | { mode: "preview" }
  | { mode: "signed"; signature: ProposalSignaturePayload };

function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortProposalNumber(id: string): string {
  // The proposal id is a cuid; the last 6 chars are stable + uniquely-enough
  // identifying for human reference on the printed document.
  return id.slice(-6).toUpperCase();
}

function renderServiceBullets(text: string | null): string {
  const body = (text && text.trim().length > 0
    ? text
    : DEFAULT_SERVICE_DESCRIPTION
  ).trim();
  const lines = body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return "";
  return `<ul class="service-list">${lines
    .map((l) => `<li>${esc(l)}</li>`)
    .join("")}</ul>`;
}

function renderMilestonesTable(milestones: ProposalMilestoneLite[]): string {
  const rows = milestones
    .map(
      (m, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(m.description)}</td>
        <td class="num">${esc(m.dueDate ? formatDate(m.dueDate) : "—")}</td>
        <td class="num">${esc(formatILS(m.amount))}</td>
      </tr>`
    )
    .join("");
  return `
    <table class="items">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>תיאור השלב</th>
          <th class="num">מועד יעד</th>
          <th class="num">סכום (כולל מע״מ)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderTermsBullets(): string {
  return `<ul class="terms-list">${GENERAL_TERMS_BULLETS.map(
    (t) => `<li>${esc(t)}</li>`
  ).join("")}</ul>`;
}

function renderSignatureBlock(opts: BuildHtmlOptions): string {
  // Always shows the service-provider details. The customer side is either
  // empty (preview) or filled with the signature image + typed name + תז + date.
  const provider = `
    <div class="sign-col">
      <div class="sign-label">פרטי נותן השירות:</div>
      <div class="sign-value">
        <strong>${esc(COMPANY_DETAILS.ownerName)}</strong>,
        ${esc(COMPANY_DETAILS.legalName)}
        (${esc(COMPANY_DETAILS.registrationLabel)} ${esc(
          COMPANY_DETAILS.registrationNumber
        )})
      </div>
      <div class="sign-line-row">
        <span class="sign-label">חתימה:</span>
        <span class="sign-line"></span>
      </div>
    </div>`;

  if (opts.mode === "signed") {
    const sig = opts.signature;
    return `
    <div class="sign-block">
      ${provider}
      <div class="sign-col customer-signed">
        <div class="sign-label">אישור הלקוח:</div>
        <div class="sign-value">
          <strong>שם:</strong> ${esc(sig.signedName)}
        </div>
        <div class="sign-value">
          <strong>ת.ז:</strong> ${esc(sig.signedIdNumber)}
        </div>
        <div class="sign-value">
          <strong>תאריך חתימה:</strong> ${esc(formatDate(sig.signedAt))}
        </div>
        <div class="sign-image-wrap">
          <span class="sign-label">חתימה:</span>
          <img class="sign-image" src="${esc(sig.signatureDataUrl)}" alt="חתימת לקוח" />
        </div>
      </div>
    </div>`;
  }

  return `
    <div class="sign-block">
      ${provider}
      <div class="sign-col">
        <div class="sign-label">אישור הלקוח:</div>
        <div class="sign-row">
          <span class="sign-label">שם:</span>
          <span class="sign-line"></span>
        </div>
        <div class="sign-row">
          <span class="sign-label">ת.ז:</span>
          <span class="sign-line"></span>
        </div>
        <div class="sign-line-row">
          <span class="sign-label">חתימה:</span>
          <span class="sign-line"></span>
        </div>
      </div>
    </div>`;
}

export function buildProposalHtml(
  proposal: ProposalPdfInput,
  opts: BuildHtmlOptions
): string {
  const title =
    proposal.quoteTitle && proposal.quoteTitle.trim()
      ? proposal.quoteTitle.trim()
      : "ליווי וניהול פרויקט מול הרשויות";
  const dateLabel = formatDate(proposal.createdAt);
  const proposalNumber = shortProposalNumber(proposal.id);
  const totalFormatted = formatILS(proposal.totalAmount);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8" />
<title>הצעת מחיר · ${esc(COMPANY_DETAILS.brandName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
<style>
  :root {
    --charcoal: ${BRAND_TOKENS.charcoal};
    --charcoal-70: ${BRAND_TOKENS.charcoal70};
    --orange: ${BRAND_TOKENS.orange};
    --cream: ${BRAND_TOKENS.cream};
    --gray-light: ${BRAND_TOKENS.grayLight};
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #FFFFFF;
    font-family: ${BRAND_TOKENS.fontStack};
    color: var(--charcoal);
    direction: rtl;
    font-size: 13px;
    line-height: 1.55;
  }
  .a4 {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 16mm 14mm 14mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }
  .a4:last-of-type { page-break-after: auto; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 14px;
    border-bottom: 2px solid var(--orange);
    margin-bottom: 18px;
  }
  .brand-name { font-size: 24px; font-weight: 900; color: var(--charcoal); line-height: 1; }
  .brand-tagline { font-size: 11px; font-weight: 500; color: var(--charcoal-70); margin-top: 2px; }
  .doc-meta {
    text-align: left;
    font-size: 11px;
    color: var(--charcoal-70);
    line-height: 1.7;
  }
  .doc-meta strong { color: var(--charcoal); font-weight: 600; }
  .doc-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--charcoal);
    margin: 4px 0 2px;
  }
  .doc-subtitle {
    font-size: 12px;
    color: var(--orange);
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-bottom: 18px;
  }
  .addressee {
    background: var(--cream);
    padding: 12px 16px;
    border-radius: 6px;
    margin-bottom: 20px;
    font-size: 12px;
  }
  .addressee .row { display: flex; gap: 24px; margin-top: 4px; flex-wrap: wrap; }
  .addressee .row > div { flex: 1 1 45%; }
  .addressee strong { color: var(--charcoal); }
  h2.section {
    font-size: 15px;
    font-weight: 700;
    color: var(--charcoal);
    margin: 18px 0 8px;
    padding-right: 10px;
    border-right: 3px solid var(--orange);
  }
  .intro p { margin: 0 0 8px; }
  ul.service-list, ul.terms-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ul.service-list li, ul.terms-list li {
    position: relative;
    padding-right: 16px;
    margin-bottom: 6px;
  }
  ul.service-list li::before, ul.terms-list li::before {
    content: "•";
    color: var(--orange);
    position: absolute;
    right: 0;
    font-weight: 800;
  }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 16px;
    font-size: 12px;
  }
  table.items thead th {
    background: var(--charcoal);
    color: var(--cream);
    padding: 8px 10px;
    text-align: right;
    font-weight: 600;
  }
  table.items thead th.num { text-align: left; }
  table.items tbody td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--gray-light);
  }
  table.items tbody tr:nth-child(even) { background: #FAFAFA; }
  .num { text-align: left; font-variant-numeric: tabular-nums; }
  .total-row { display: flex; justify-content: flex-start; margin: 12px 0 18px; }
  .total-box {
    border: 2px solid var(--orange);
    background: #FDECE2;
    padding: 12px 18px;
    border-radius: 8px;
    min-width: 220px;
  }
  .total-box .label {
    font-size: 10.5px;
    color: var(--charcoal-70);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .total-box .amount {
    font-size: 20px;
    font-weight: 800;
    color: var(--charcoal);
  }
  .sign-block {
    display: flex;
    gap: 24px;
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px dashed var(--gray-light);
  }
  .sign-col { flex: 1; font-size: 12px; }
  .sign-col .sign-label { font-size: 11px; color: var(--charcoal-70); font-weight: 600; }
  .sign-col .sign-value { margin-top: 4px; }
  .sign-row, .sign-line-row {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    margin-top: 10px;
  }
  .sign-line {
    flex: 1;
    border-bottom: 1px solid var(--charcoal);
    height: 18px;
  }
  .sign-image-wrap {
    margin-top: 10px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .sign-image {
    max-height: 64px;
    max-width: 220px;
    border-bottom: 1px solid var(--charcoal);
    padding-bottom: 2px;
  }
  .footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 2px solid var(--orange);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    color: var(--charcoal-70);
  }
  .footer .slogan { color: var(--orange); font-weight: 600; letter-spacing: 0.04em; }
  .footer strong { color: var(--charcoal); }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
  <div class="a4">
    <div class="header">
      <div class="brand">
        <div class="brand-name">${esc(COMPANY_DETAILS.brandName)}</div>
        <div class="brand-tagline">${esc(COMPANY_DETAILS.brandTagline)}</div>
      </div>
      <div class="doc-meta">
        <div><strong>תאריך:</strong> ${esc(dateLabel)}</div>
        <div><strong>מס׳ הצעה:</strong> ${esc(proposalNumber)}</div>
        <div><strong>תוקף:</strong> 14 ימים</div>
      </div>
    </div>

    <div class="doc-title">הצעת מחיר</div>
    <div class="doc-subtitle">${esc(title)}</div>

    <div class="addressee">
      <div class="row">
        <div><strong>לכבוד:</strong> ${esc(proposal.customerName)}</div>
        <div><strong>טלפון:</strong> ${esc(proposal.customerPhone)}</div>
      </div>
      <div class="row">
        ${proposal.customerEmail ? `<div><strong>אימייל:</strong> ${esc(proposal.customerEmail)}</div>` : ""}
        ${proposal.projectLocation ? `<div><strong>מיקום הפרויקט:</strong> ${esc(proposal.projectLocation)}</div>` : ""}
      </div>
    </div>

    <h2 class="section">1. הקדמה ומהות השירות</h2>
    <div class="intro">
      <p>תודה על פנייתכם ועל ההזדמנות להציע את שירותינו. משרדנו מתמחה בניהול הליכי רישוי וליווי פרויקטים מול הרשויות המקומיות. מטרתנו היא להוביל את הפרויקט עד לקבלת תעודת גמר תוך ריכוז כלל הדרישות הבירוקרטיות, ביעילות ובמהירות המקסימלית.</p>
      <p><strong>השירות כולל:</strong></p>
      ${renderServiceBullets(proposal.serviceDescription)}
    </div>

    <h2 class="section">2. עלות השירות ואופן התשלום</h2>
    <p>סה״כ עלות השירות: <strong>${esc(totalFormatted)}</strong> כולל מע״מ.</p>
    ${renderMilestonesTable(proposal.milestones)}
    <div class="total-row">
      <div class="total-box">
        <div class="label">סה״כ לתשלום (כולל מע״מ)</div>
        <div class="amount">${esc(totalFormatted)}</div>
      </div>
    </div>

    <div class="footer">
      <div><span class="slogan">${esc(COMPANY_DETAILS.slogan)}</span></div>
      <div>
        <strong>${esc(COMPANY_DETAILS.ownerName)}</strong> · ${esc(COMPANY_DETAILS.email)} · ${esc(COMPANY_DETAILS.phone)}
      </div>
    </div>
  </div>

  <div class="a4">
    <div class="header">
      <div class="brand">
        <div class="brand-name">${esc(COMPANY_DETAILS.brandName)}</div>
        <div class="brand-tagline">${esc(COMPANY_DETAILS.brandTagline)}</div>
      </div>
      <div class="doc-meta">
        <div><strong>מס׳ הצעה:</strong> ${esc(proposalNumber)}</div>
        <div><strong>עמ׳:</strong> 2 / 2</div>
      </div>
    </div>

    <h2 class="section">3. תנאים כלליים</h2>
    ${renderTermsBullets()}

    <h2 class="section">4. חתימות ואישור</h2>
    ${renderSignatureBlock(opts)}

    <div class="footer">
      <div><span class="slogan">${esc(COMPANY_DETAILS.slogan)}</span></div>
      <div>
        <strong>${esc(COMPANY_DETAILS.ownerName)}</strong> · ${esc(COMPANY_DETAILS.email)} · ${esc(COMPANY_DETAILS.phone)} · ${esc(COMPANY_DETAILS.address)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Renders the HTML to a PDF buffer.
//
// Two execution paths:
// 1. Vercel / serverless — uses @sparticuz/chromium for a slim chromium binary
//    bundled at runtime.
// 2. Local dev / Windows — falls back to regular `puppeteer` if installed; if
//    neither is available, throws a descriptive error so the admin can install
//    the local-dev package on demand.
export async function renderPdfBuffer(html: string): Promise<Buffer> {
  const onVercel = !!process.env.VERCEL || !!process.env.AWS_REGION;

  if (onVercel) {
    const [{ default: chromium }, puppeteer] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core")
    ]);
    // Force "shell" headless mode — required for the bundled chromium binary
    // and avoids the new-headless dependency on libs that aren't always
    // present on Vercel's runtime.
    chromium.setHeadlessMode = true;
    const browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-web-security",
        "--font-render-hinting=none"
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true
      });
      return Buffer.from(buf);
    } finally {
      await browser.close();
    }
  }

  // Local: prefer regular `puppeteer` (downloads its own chromium). If only
  // `puppeteer-core` is available, the caller must set PUPPETEER_EXECUTABLE_PATH.
  try {
    // `puppeteer` is intentionally not a declared dependency — only used as a
    // local-dev convenience if installed manually. The dynamic import is
    // wrapped in try/catch so the fallback path handles missing module.
    // @ts-expect-error optional peer
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true
      });
      return Buffer.from(buf);
    } finally {
      await browser.close();
    }
  } catch {
    const puppeteer = await import("puppeteer-core");
    const exec = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!exec) {
      throw new Error(
        "PDF renderer: install `puppeteer` for local dev, or set PUPPETEER_EXECUTABLE_PATH."
      );
    }
    const browser = await puppeteer.default.launch({
      headless: true,
      executablePath: exec
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true
      });
      return Buffer.from(buf);
    } finally {
      await browser.close();
    }
  }
}
