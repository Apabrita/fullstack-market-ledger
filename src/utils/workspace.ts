/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Google Workspace client-side REST API service for Sheets, Drive, Docs, and Calendar.
 * This runs directly in the browser using the OAuth access token.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from "firebase/auth";
import {
  NFCData,
  Transaction,
  DailyCollection,
  SourcePayment,
  Buyer,
  Source,
} from "../db";
import firebaseConfig from "../../firebase-applet-config.json";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/documents");
provider.addScope("https://www.googleapis.com/auth/calendar.events");

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let googleUser: User | null = null;

// Call this from App or useEffect to stay synced
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
) => {
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          googleUser = result.user;
          if (onAuthSuccess) onAuthSuccess(result.user, credential.accessToken);
        }
      }
    })
    .catch((err) => console.error("Redirect Error:", err));

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        googleUser = user;
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        googleUser = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      googleUser = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export function isWorkspaceConnected(): boolean {
  return cachedAccessToken !== null;
}

export function getWorkspaceToken(): string | null {
  return cachedAccessToken;
}

export const initiateGoogleOAuth = async (): Promise<boolean> => {
  if (isSigningIn) {
    console.warn("Sign-in already in progress.");
    return false;
  }
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
    // In a redirect flow, the page will reload.
    // It returns true theoretically but usually never reaches here.
    return true;
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const clearWorkspaceToken = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  googleUser = null;
};

// No longer needed
export function getCustomClientId(): string {
  return "";
}
export function saveCustomClientId(cliId: string) {}
export function checkAndParseOAuthHash(): boolean {
  return false;
}

// ===================================
// 1. Google Sheets Integration APIs
// ===================================

interface SheetsSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  rowsAdded: number;
}

export async function createSpreadsheet(
  title: string,
  sheetNames: string[],
): Promise<string> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  // Construct request payload to build a fresh spreadsheet with predefined sheets/tabs
  const sheets = sheetNames.map((name) => ({
    properties: { title: name },
  }));

  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets,
    }),
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to create spreadsheet: ${errorDetails.error?.message || res.statusText}`,
    );
  }

  const data = await res.json();
  return data.spreadsheetId;
}

export async function appendSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][],
): Promise<number> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Failed appending data: ${errorDetails.error?.message || res.statusText}`,
    );
  }

  const result = await res.json();
  return result.updates?.updatedRows || 0;
}

/**
 * Triggers full workspace synchronization of PDFs equivalent data to Sheets
 */
export async function syncDataToGoogleSheets(
  data: NFCData,
  reportType: "auction" | "source_payment" | "collection" | "collection_slip",
  currentDate: string = "2026-06-09",
): Promise<SheetsSyncResult> {
  const dateStr = currentDate;

  // Decide sheet headers and body rows based on the report type
  let sheetName = "";
  let headers: string[] = [];
  let rows: any[][] = [];

  if (reportType === "auction") {
    sheetName = "Auction Journal";
    headers = [
      "Trade Time/Date",
      "Transaction ID",
      "Fish Type Species",
      "Source Source ID",
      "Wholesale Buyer ID",
      "Weight (KG)",
      "Rate per KG (৳)",
      "Calculated Total (৳)",
      "Operator/Auctioneer",
    ];

    const transactions = data.transactions || [];
    rows = transactions.map((tx) => [
      tx.date || dateStr,
      tx.id,
      tx.fish_type,
      tx.source_id,
      tx.buyer_id,
      tx.weight,
      tx.price_per_kg,
      tx.total_price,
      tx.added_by || "Apon Das",
    ]);
  } else if (reportType === "source_payment") {
    sheetName = "Source Landings";
    headers = [
      "Settlement Date",
      "Payment ID",
      "Source Source ID",
      "Delivered Weight (KG)",
      "Agreed Landing Rate (৳)",
      "Estimated Sales Total (৳)",
      "Broker Commission (৳)",
      "Net Share Settled Cash (৳)",
      "Status",
    ];

    const payments = data.source_payments || [];
    rows = payments.map((p) => [
      p.date || dateStr,
      p.id,
      p.source_id,
      p.total_kg,
      p.rate_per_kg,
      p.sale_total,
      p.commission,
      p.amount_paid_to_source,
      p.is_settled ? "SETTLED" : "UNSETTLED",
    ]);
  } else if (reportType === "collection") {
    sheetName = "Revenue Collections";
    headers = [
      "Payment Date",
      "Receipt ID",
      "Buyer Client ID",
      "Prior Rollover Outstanding (৳)",
      "Current Billings (৳)",
      "Amount Received (৳)",
      "Approved In Vault",
      "Current Post-trade Balance (৳)",
    ];

    const collections = data.daily_collections || [];
    rows = collections.map((col) => {
      const buyer = data.buyers.find((b) => b.id === col.buyer_id);
      return [
        col.date || dateStr,
        col.id,
        buyer?.nickname || `ID: ${col.buyer_id}`,
        col.total_owed_today - col.amount_paid,
        col.total_owed_today,
        col.amount_paid,
        col.is_approved ? "APPROVED" : "PENDING",
        buyer?.lifetime_debt || 0,
      ];
    });
  } else {
    sheetName = "Buyer Account Invoices";
    headers = [
      "Buyer Nickname",
      "Starting Rollover Debt (৳)",
      "Today Purchases Billings (৳)",
      "Total Payments Paid (৳)",
      "End-of-day Outstanding Balance (৳)",
      "Limits Standard (৳)",
    ];

    const buyers = data.buyers || [];
    rows = buyers.map((b) => {
      const bTxList = (data.transactions || []).filter(
        (tx) => String(tx.buyer_id) === String(b.id),
      );
      const todayTotal = bTxList.reduce((sum, tx) => sum + tx.total_price, 0);
      const bColList = (data.daily_collections || []).filter(
        (c) => String(c.buyer_id) === String(b.id),
      );
      const todayPaid = bColList.reduce((sum, c) => sum + c.amount_paid, 0);
      const startDebt = Math.max(0, b.lifetime_debt - todayTotal + todayPaid);
      return [
        b.nickname,
        startDebt,
        todayTotal,
        todayPaid,
        b.lifetime_debt,
        b.credit_limit,
      ];
    });
  }

  // Combine title
  const spreadsheetTitle = `New Fish Center - ${sheetName} Register [${currentDate}]`;
  const spreadsheetId = await createSpreadsheet(spreadsheetTitle, [sheetName]);

  // Append headers
  await appendSheetValues(spreadsheetId, `${sheetName}!A1`, [headers]);

  // Append row values
  let rowsAdded = 0;
  if (rows.length > 0) {
    rowsAdded = await appendSheetValues(spreadsheetId, `${sheetName}!A2`, rows);
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    rowsAdded,
  };
}

// ===================================
// 2. Google Drive Integration APIs
// ===================================

interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export async function uploadFileToGoogleDrive(
  name: string,
  content: string,
  mimeType: string = "text/plain",
): Promise<DriveUploadResult> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  // Generate multi-part upload body for Drive API v3 to declare both metadata and file content bytes
  const metadata = {
    name,
    mimeType,
  };

  const boundary = "314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to upload to Google Drive: ${errorDetails.error?.message || res.statusText}`,
    );
  }

  const data = await res.json();
  return {
    fileId: data.id,
    webViewLink:
      data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

export function constructPlainReportText(
  data: NFCData,
  reportType: "auction" | "source_payment" | "collection" | "collection_slip",
  currentDate: string = "2026-06-09",
): string {
  const dateStr = currentDate;
  let txt = `========================================================================\n`;
  txt += `                      NEW FISH CENTER                     \n`;
  txt += `        Commission Agent and Wholesaler • Proprietor: Chanchal Das       \n`;
  txt += `                       BALIA, Chakdaha, Nadia                       \n`;
  txt += `========================================================================\n`;
  txt += `Report Type: ${reportType.toUpperCase()} JOURNAL\n`;
  txt += `Log Date: ${dateStr}\n`;
  txt += `Generated Timestamp: ${new Date().toLocaleTimeString()}\n`;
  txt += `------------------------------------------------------------------------\n\n`;

  if (reportType === "auction") {
    txt += `DAILY AUCTION DISPATCH ENTRIES:\n`;
    txt += `ID          | SOURCE   | BUYER COMPANY         | FISH SPECIES        | KG   | RATE | TOTAL\n`;
    txt += `------------+-----------+-----------------------+---------------------+------+------+---------\n`;
    const transactions = data.transactions || [];
    transactions.forEach((tx) => {
      const b = data.buyers.find((x) => x.id === tx.buyer_id);
      const s = data.sources.find((x) => x.id === tx.source_id);
      txt += `${String(tx.id).padEnd(11)} | ${String(s?.name || tx.source_id)
        .substring(0, 9)
        .padEnd(9)} | ${String(b?.nickname || tx.buyer_id)
        .substring(0, 21)
        .padEnd(
          21,
        )} | ${String(tx.fish_type).substring(0, 19).padEnd(19)} | ${String(tx.weight).padStart(4)} | ${String(tx.price_per_kg).padStart(4)} | ৳${String(tx.total_price).padStart(7)}\n`;
    });

    const totalVolume = transactions.reduce(
      (sum, tx) => sum + tx.total_price,
      0,
    );
    const totalWeight = transactions.reduce((sum, tx) => sum + tx.weight, 0);
    txt += `------------------------------------------------------------------------\n`;
    txt += `TOTAL CRATES RECORDED: ${transactions.length}\n`;
    txt += `TOTAL WEIGHT METRICS : ${totalWeight} KG\n`;
    txt += `TOTAL SALES REVENUE  : ৳${totalVolume}\n`;
  } else if (reportType === "source_payment") {
    txt += `SOURCE commission & NET PAYOUT SETTLEMENTS:\n`;
    txt += `ID          | VESSEL SOURCE NAME            | TOTAL WEIGHT | SALE SUM | COMMISION | NET PAYOUT\n`;
    txt += `------------+-------------------------------+--------------+----------+-----------+------------\n`;
    const payments = data.source_payments || [];
    payments.forEach((p) => {
      const s = data.sources.find((x) => x.id === p.source_id);
      txt += `${String(p.id).padEnd(11)} | ${String(s?.name || p.source_id)
        .substring(0, 29)
        .padEnd(
          29,
        )} | ${String(p.total_kg).padStart(8)} | ৳${String(p.sale_total).padStart(6)} | ৳${String(p.commission).padStart(7)} | ৳${String(p.amount_paid_to_source).padStart(9)}\n`;
    });

    const totalCommission = payments.reduce((sum, p) => sum + p.commission, 0);
    const totalPayouts = payments.reduce(
      (sum, p) => sum + p.amount_paid_to_source,
      0,
    );
    txt += `------------------------------------------------------------------------\n`;
    txt += `TOTAL LANDINGS REGISTERED : ${payments.length}\n`;
    txt += `TOTAL SYSTEM COMMISSIONS  : ৳${totalCommission}\n`;
    txt += `TOTAL DISTRIBUTED PAYOUT  : ৳${totalPayouts}\n`;
  } else if (reportType === "collection") {
    txt += `DAILY CASH Vault & DEBT PORTFOLIO LOGS:\n`;
    txt += `RECEIPT ID  | BUYER ACCOUNT NAME    | PREV DEBT | COLS TODAY | COLLECTED | VAULT STATUS\n`;
    txt += `------------+-----------------------+-----------+------------+-----------+--------------\n`;
    const collections = data.daily_collections || [];
    collections.forEach((col) => {
      const b = data.buyers.find((x) => x.id === col.buyer_id);
      txt += `${String(col.id).padEnd(11)} | ${String(
        b?.nickname || col.buyer_id,
      )
        .substring(0, 21)
        .padEnd(
          21,
        )} | ৳${String(col.total_owed_today - col.amount_paid).padStart(7)} | ৳${String(col.total_owed_today).padStart(8)} | ৳${String(col.amount_paid).padStart(7)} | ${col.is_approved ? "APPROVED (VAULT)" : "PENDING"}\n`;
    });

    const approvedCash = collections
      .filter((c) => c.is_approved)
      .reduce((sum, c) => sum + c.amount_paid, 0);
    const pendingCash = collections
      .filter((c) => !c.is_approved)
      .reduce((sum, c) => sum + c.amount_paid, 0);
    txt += `------------------------------------------------------------------------\n`;
    txt += `APPROVED REVENUE (IN VAULT): ৳${approvedCash}\n`;
    txt += `PENDING CASHIER DRAFTS    : ৳${pendingCash}\n`;
  } else {
    txt += `BUYER ACCOUNT STATUS SLIPS SUMMARY:\n`;
    const buyers = data.buyers || [];
    buyers.forEach((b, idx) => {
      const bTxList = (data.transactions || []).filter(
        (tx) => String(tx.buyer_id) === String(b.id),
      );
      const bColList = (data.daily_collections || []).filter(
        (c) => String(c.buyer_id) === String(b.id),
      );
      const purchases = bTxList.reduce((sum, tx) => sum + tx.total_price, 0);
      const payments = bColList.reduce((sum, c) => sum + c.amount_paid, 0);
      const startDebt = Math.max(0, b.lifetime_debt - purchases + payments);

      txt += `${idx + 1}. BUYER: ${b.nickname}\n`;
      txt += `   Outstanding Rollover: ৳${startDebt}\n`;
      txt += `   Billings/Buys Today : ৳${purchases}\n`;
      txt += `   Payments Made today: ৳${payments}\n`;
      txt += `   Final Account Debt  : ৳${b.lifetime_debt} (Limit: ৳${b.credit_limit})\n`;
      txt += `   ---------------------------------------------\n`;
    });
  }

  txt += `\n========================================================================\n`;
  txt += `End of report. Digitally verified by Primary Operator Apon Das.\n`;
  txt += `========================================================================\n`;
  return txt;
}

// ===================================
// 3. Google Docs Integration APIs
// ===================================

interface DocsDraftResult {
  documentId: string;
  documentUrl: string;
}

export async function createGoogleDocument(title: string): Promise<string> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const res = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
    }),
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to create Google Doc: ${errorDetails.error?.message || res.statusText}`,
    );
  }

  const d = await res.json();
  return d.documentId;
}

export async function insertDocumentText(
  documentId: string,
  text: string,
): Promise<void> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text,
      },
    },
  ];

  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests,
      }),
    },
  );

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Failed updating Doc text: ${errorDetails.error?.message || res.statusText}`,
    );
  }
}

export async function syncReportToGoogleDocs(
  data: NFCData,
  reportType: "auction" | "source_payment" | "collection" | "collection_slip",
  currentDate: string = "2026-06-09",
): Promise<DocsDraftResult> {
  const formattedText = constructPlainReportText(data, reportType, currentDate);
  const titles = {
    auction: `New Fish Center - Daily Auction Log [${currentDate}]`,
    source_payment: `New Fish Center - Source Commission settlements [${currentDate}]`,
    collection: `New Fish Center - Daily Revenue & Cash Logs [${currentDate}]`,
    collection_slip: `New Fish Center - Buyer Invoices [${currentDate}]`,
  };

  const title = titles[reportType];
  const documentId = await createGoogleDocument(title);
  await insertDocumentText(documentId, formattedText);

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

// ===================================
// 4. Google Calendar Integration APIs
// ===================================

interface CalendarLandingSyncResult {
  eventsCreated: number;
}

export async function createCalendarEvent(
  summary: string,
  description: string,
  startTime: string,
  endTime: string,
): Promise<any> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const event = {
    summary,
    description,
    start: {
      dateTime: startTime,
      timeZone: "Asia/Dhaka", // Primary target market time
    },
    end: {
      dateTime: endTime,
      timeZone: "Asia/Dhaka",
    },
    colorId: "2", // Sea Green / Blue for maritime events
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(
      `Calendar event creation failed: ${errorDetails.error?.message || res.statusText}`,
    );
  }

  return await res.json();
}

/**
 * Sync active vessel arrivals as calendar events to organize work shifts
 */
export async function syncSourcesToGoogleCalendar(
  data: NFCData,
  currentDate: string = "2026-06-09",
): Promise<CalendarLandingSyncResult> {
  const sources = data.sources || [];
  let eventsCreated = 0;

  for (const s of sources) {
    const isCompleted = s.is_completed;
    const summary = `⚓ Landing/Auction: ${s.name}`;
    let description = `Vessel Name: ${s.name}\n`;
    description += `Vessel ID  : ${s.id}\n`;
    description += `Settlement Rate: ৳${s.rate_per_kg}/KG\n`;
    description += `Daily Operations Class: Wholesale Landing Dispatch\n`;
    description += `Status: ${isCompleted ? "Completed Landing Trade" : "ACTIVE LANDING UNDERWAY"}\n`;

    // Construct startTime and endTime
    const startTime = `${currentDate}T08:00:00+06:00`; // Market opens early morning 8 AM
    const endTime = `${currentDate}T13:00:00+06:00`; // Main landings finish by noon

    await createCalendarEvent(summary, description, startTime, endTime);
    eventsCreated++;
  }

  return {
    eventsCreated,
  };
}
