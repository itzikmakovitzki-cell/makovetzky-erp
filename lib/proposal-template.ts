// Boilerplate constants for the V2 (PDF) proposal template.
//
// Variable per-quote: customer info, quoteTitle, serviceDescription (user can
// edit, but ships with DEFAULT_SERVICE_DESCRIPTION), totalAmount, milestones.
//
// Fixed for every quote: GENERAL_TERMS_BULLETS, COMPANY_DETAILS, BRAND_TOKENS.
// Per the user's call: the four general terms (gilui naot) are identical
// across every quote, so we don't expose them in the admin form.

// Israeli VAT rate as of Jan 1, 2025 — 18%. Update here if the rate changes.
export const VAT_RATE = 0.18;
export const VAT_RATE_LABEL = "18%";

export const BRAND_TOKENS = {
  charcoal: "#1F2937",
  charcoal70: "#4A5562",
  orange: "#E25822",
  cream: "#F5F1E8",
  grayLight: "#E5E7EB",
  fontStack: "'Heebo', Arial, sans-serif"
} as const;

export const COMPANY_DETAILS = {
  legalName: "מקובצקי ניהול פרויקטים",
  brandName: "מקובצקי",
  brandTagline: "ניהול פרויקטים",
  slogan: "הביורוקרטיה — עלינו",
  ownerName: "בת אור מקובצקי",
  ownerTitle: "מנהלת פרויקטים",
  registrationNumber: "516208261",
  registrationLabel: "ח.פ",
  phone: "050-9090201",
  email: "bator@makomedia.co.il",
  address: "אלי הורביץ 12 רחובות"
} as const;

// Default copy for the "מהות השירות" section. Each line becomes one bullet.
// Mirrors the structure of the old paper quote (4 bullets) but the admin can
// edit them per-quote — these are just the smart default.
export const DEFAULT_SERVICE_DESCRIPTION = [
  "ניהול מערך היועצים: ריכוז וחתימת כלל היועצים (חשמל, אינסטלציה, קונסטרוקציה וכו') בהתאם לדרישות ההיתר.",
  "תיאום מול העירייה: הזמנת מחלקות העירייה לביקורות שטח וניהול הקשר הישיר מול הגורמים המאשרים.",
  "ניהול תיק הפיקוח: איסוף, ריכוז והגשת תיק פיקוח סופי למפקח הפרויקט מטעם הוועדה.",
  "בקרה וליווי שטח: פגישות עבודה תקופתיות וקביעת משימות לביצוע לטובת עמידה בתקני הרשות."
].join("\n");

// The four general terms shown in section 3 of every signed quote. Hard-coded
// per the user's call ("התנאים זהים, כמו הגילוי נאות").
export const GENERAL_TERMS_BULLETS: readonly string[] = [
  "ההצעה תקפה ל-14 ימים ממועד הוצאתה.",
  "התשלום עבור שלב הגמר יבוצע לא יאוחר מסיום אותו חודש קלנדרי בו התקבל האישור.",
  "במידה ופעולות מצד נותן השירות הושלמו אך הפרויקט לא הסתיים עקב גורם חיצוני/כוח עליון, התשלום יועבר במלואו (למעט 5% בטחון).",
  "המחיר אינו כולל: אגרות עירייה, היטלים, או תשלומים ישירים ליועצים חיצוניים/מעבדות."
] as const;

export type ProposalSignaturePayload = {
  signedName: string;
  signedIdNumber: string;
  signatureDataUrl: string;
  signedAt: Date;
};
