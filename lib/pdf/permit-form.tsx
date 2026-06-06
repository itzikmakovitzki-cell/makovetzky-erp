import * as React from "react";
import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View
} from "@react-pdf/renderer";

// Block 40 — auto-filled permit form generator (V1 "הצהרת אחראי /
// טופס דיווח").
//
// Hebrew RTL gotchas with @react-pdf/renderer:
//   * Fonts must be registered ONCE per process — Font.register caches
//     by family. We read the Heebo TTFs from public/fonts/heebo/ via
//     fs (we're in a Node API route), so no network fetch at request
//     time and no Vercel cold-start penalty beyond the static asset.
//   * Hebrew text needs the font's bidi tables. Heebo ships with them.
//     We pass `direction="rtl"` on the root Page so layout flows R→L,
//     and `textAlign: 'right'` so paragraph anchoring matches.
//   * Mixed-direction lines (Hebrew label + LTR phone number) render
//     correctly without extra hints as long as the Page direction is
//     rtl — fontkit handles per-run direction.

let fontsRegistered = false;
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  // process.cwd() is the project root under `next start` and `vercel dev`.
  // In production Vercel functions, public/ assets are bundled alongside
  // the handler so the same path resolves. fontkit reads file:// paths
  // directly (passing a Buffer requires manually shimming `src` typing
  // anyway).
  const fontsDir = path.join(process.cwd(), "public", "fonts", "heebo");
  Font.register({
    family: "Heebo",
    fonts: [
      { src: path.join(fontsDir, "Heebo-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "Heebo-Bold.ttf"), fontWeight: "bold" }
    ]
  });
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontFamily: "Heebo",
    fontSize: 11,
    color: "#1F2937",
    lineHeight: 1.55
  },
  brandRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 18,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#E25822",
    borderBottomStyle: "solid"
  },
  brandName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937"
  },
  brandTagline: {
    fontSize: 9,
    color: "#6B7280"
  },
  formMeta: {
    fontSize: 8,
    color: "#6B7280",
    textAlign: "left"
  },
  formTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    color: "#1F2937"
  },
  formSubtitle: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 20,
    color: "#374151"
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    borderBottomStyle: "solid",
    textAlign: "right"
  },
  // 2-column key/value table. We use row-reverse so labels sit on the
  // right edge in the RTL flow.
  row: {
    flexDirection: "row-reverse",
    paddingVertical: 3
  },
  label: {
    width: 110,
    fontWeight: "bold",
    color: "#374151",
    textAlign: "right"
  },
  value: {
    flex: 1,
    color: "#1F2937",
    textAlign: "right"
  },
  // Placeholder line used when a structured field (gush/helka) isn't on
  // file yet — gives the user something tangible to fill by hand.
  blankLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    borderBottomStyle: "solid",
    minHeight: 14
  },
  contextBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: "#FEF3EC",
    borderRightWidth: 3,
    borderRightColor: "#E25822",
    borderRightStyle: "solid"
  },
  contextLabel: {
    fontWeight: "bold",
    marginBottom: 2,
    textAlign: "right"
  },
  contextBody: {
    textAlign: "right"
  },
  declarationBody: {
    marginTop: 14,
    textAlign: "right",
    lineHeight: 1.7
  },
  signatureGrid: {
    flexDirection: "row-reverse",
    marginTop: 40,
    gap: 40
  },
  signatureCell: {
    flex: 1
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#1F2937",
    borderBottomStyle: "solid",
    height: 28
  },
  signatureCaption: {
    marginTop: 4,
    fontSize: 9,
    color: "#6B7280",
    textAlign: "right"
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    right: 56,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    borderTopStyle: "solid"
  }
});

export type PermitFormData = {
  permit: {
    name: string;
    permitNumber: string | null;
    gush: string | null; // not yet in schema — render blank line if absent
    helka: string | null;
    authorityName: string;
  };
  client: {
    companyName: string;
    contactName: string;
    phone: string;
    address: string | null;
  };
  buildings: { label: string; address: string | null }[];
  task: {
    name: string;
    category: string | null;
    description: string | null;
  };
  generatedAt: Date;
  generatedBy: string;
};

function formatDateIL(d: Date): string {
  // No Intl in some serverless runtimes is shaky; manual ddmmyyyy is safer.
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function PermitFormDocument({ data }: { data: PermitFormData }) {
  ensureFontsRegistered();

  const buildingAddress = data.buildings.find((b) => b.address)?.address ?? null;
  const propertyAddress = buildingAddress ?? data.client.address ?? null;
  const generated = formatDateIL(data.generatedAt);

  return (
    <Document
      title={`טופס דיווח — ${data.permit.name}`}
      author="מקובצקי ניהול פרויקטים"
      creator="מקובצקי ERP"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.brandName}>מקובצקי ניהול פרויקטים</Text>
            <Text style={styles.brandTagline}>הביורוקרטיה — עלינו</Text>
          </View>
          <View style={styles.formMeta}>
            <Text>הופק: {generated}</Text>
            <Text>ע״י: {data.generatedBy}</Text>
          </View>
        </View>

        <Text style={styles.formTitle}>טופס דיווח</Text>
        <Text style={styles.formSubtitle}>
          לפרויקט: {data.permit.name}
        </Text>

        <Text style={styles.sectionHeader}>פרטי לקוח</Text>
        <View style={styles.row}>
          <Text style={styles.label}>שם:</Text>
          <Text style={styles.value}>
            {data.client.contactName} ({data.client.companyName})
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>טלפון:</Text>
          <Text style={styles.value}>{data.client.phone || "—"}</Text>
        </View>

        <Text style={styles.sectionHeader}>פרטי הנכס</Text>
        <View style={styles.row}>
          <Text style={styles.label}>כתובת:</Text>
          {propertyAddress ? (
            <Text style={styles.value}>{propertyAddress}</Text>
          ) : (
            <View style={styles.blankLine} />
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>גוש:</Text>
          {data.permit.gush ? (
            <Text style={styles.value}>{data.permit.gush}</Text>
          ) : (
            <View style={styles.blankLine} />
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>חלקה:</Text>
          {data.permit.helka ? (
            <Text style={styles.value}>{data.permit.helka}</Text>
          ) : (
            <View style={styles.blankLine} />
          )}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>מס׳ היתר:</Text>
          <Text style={styles.value}>{data.permit.permitNumber ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>רשות מקומית:</Text>
          <Text style={styles.value}>{data.permit.authorityName}</Text>
        </View>

        <View style={styles.contextBox}>
          <Text style={styles.contextLabel}>הנדון:</Text>
          <Text style={styles.contextBody}>
            ביצוע משימת — {data.task.name}
            {data.task.category ? ` (${data.task.category})` : ""}
          </Text>
        </View>

        {data.task.description && (
          <View style={styles.declarationBody}>
            <Text>{data.task.description}</Text>
          </View>
        )}

        <View style={styles.declarationBody}>
          <Text>
            אני, החתום מטה, מצהיר בזאת כי ביצעתי את המשימה הנ״ל בהתאם להוראות
            ההיתר, התקנים החלים, ודרישות הרשות המקומית. הצהרה זו מהווה אסמכתא
            להעברה לתיק ההיתר.
          </Text>
        </View>

        <View style={styles.signatureGrid}>
          <View style={styles.signatureCell}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>
              חתימת הקבלן / איש המקצוע
            </Text>
          </View>
          <View style={styles.signatureCell}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>תאריך</Text>
          </View>
        </View>

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `נוצר במערכת מקובצקי ERP · עמוד ${pageNumber} מתוך ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
