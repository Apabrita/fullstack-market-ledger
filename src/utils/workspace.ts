/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Google Workspace client-side REST API service for Sheets, Drive, Docs, and Calendar.
 * This runs directly in the browser using the OAuth access token.
 */

import { NFCData, Transaction, DailyCollection, SourcePayment, Buyer, Source } from "../db";

// Memory cache for Google OAuth token
let cachedToken: string | null = null;
let customClientId: string = "";

// Check if workspace authentication is active
export function isWorkspaceConnected(): boolean {
  if (cachedToken) return true;
  if (typeof window !== "undefined") {
    return localStorage.getItem("google_workspace_token") !== null;
  }
  return false;
}

// Get the current active token
export function getWorkspaceToken(): string | null {
  if (cachedToken) return cachedToken;
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("google_workspace_token");
    const expiry = localStorage.getItem("google_workspace_token_expiry");
    if (token && expiry) {
      if (Date.now() < Number(expiry)) {
        cachedToken = token;
        return token;
      } else {
        // Expired
        clearWorkspaceToken();
      }
    }
  }
  return null;
}

// Save token to memory and localStorage
export function saveWorkspaceToken(token: string, expiresInSeconds: number = 3600) {
  cachedToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("google_workspace_token", token);
    const expiry = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem("google_workspace_token_expiry", String(expiry));
  }
}

// Clear token
export function clearWorkspaceToken() {
  cachedToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_workspace_token");
    localStorage.removeItem("google_workspace_token_expiry");
  }
}

// Manage custom client ID
export function getCustomClientId(): string {
  if (customClientId) return customClientId;
  if (typeof window !== "undefined") {
    return localStorage.getItem("google_workspace_client_id") || "954441923225-placeholder-client-id.apps.googleusercontent.com";
  }
  return "";
}

export function saveCustomClientId(clientId: string) {
  customClientId = clientId;
  if (typeof window !== "undefined") {
    localStorage.setItem("google_workspace_client_id", clientId);
  }
}

// Initiates standard GIS implicit grant flow popup
export function initiateGoogleOAuth() {
  const cliId = getCustomClientId();
  const redirectUri = window.location.origin + window.location.pathname;
  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/calendar.events"
  ].join(" ");

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(cliId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&include_granted_scopes=true` +
    `&state=newfishcenter` +
    `&login_hint=newfishcenter%45gmail.com`.replace('%45', '@');

  // Open the redirect in a secure popup or within the current window if popup fails
  const width = 500;
  const height = 600;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;
  
  const popup = window.open(authUrl, "Google Sign-In", `width=${width},height=${height},left=${left},top=${top}`);
  
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // If popup is blocked, redirect the top window
    window.location.href = authUrl;
  }
}

// Process OAuth response parameters in hash code
export function checkAndParseOAuthHash(): boolean {
  if (typeof window === "undefined" || !window.location.hash) return false;
  
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const expiresIn = params.get("expires_in");
  
  if (accessToken) {
    saveWorkspaceToken(accessToken, expiresIn ? Number(expiresIn) : 3600);
    // Clear hash cleanly
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  }
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

export async function createSpreadsheet(title: string, sheetNames: string[]): Promise<string> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  // Construct request payload to build a fresh spreadsheet with predefined sheets/tabs
  const sheets = sheetNames.map(name => ({
    properties: { title: name }
  }));

  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties: { title },
      sheets
    })
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Failed to create spreadsheet: ${errorDetails.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.spreadsheetId;
}

export async function appendSheetValues(spreadsheetId: string, range: string, values: any[][]): Promise<number> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      values
    })
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Failed appending data: ${errorDetails.error?.message || res.statusText}`);
  }

  const result = await res.json();
  return result.updates?.updatedRows || 0;
}

/**
 * Triggers full workspace synchronization of PDFs equivalent data to Sheets
 */
export async function syncDataToGoogleSheets(data: NFCData, reportType: "auction" | "source_payment" | "collection" | "collection_slip"): Promise<SheetsSyncResult> {
  const dateStr = "2026-06-09";
  
  // Decide sheet headers and body rows based on the report type
  let sheetName = "";
  let headers: string[] = [];
  let rows: any[][] = [];

  if (reportType === "auction") {
    sheetName = "Auction Journal";
    headers = ["Trade Time/Date", "Transaction ID", "Fish Type Species", "Source Trawler ID", "Wholesale Buyer ID", "Weight (KG)", "Rate per KG (৳)", "Calculated Total (৳)", "Operator/Auctioneer"];
    
    const transactions = data.transactions || [];
    rows = transactions.map(tx => [
      tx.date || dateStr,
      tx.id,
      tx.fish_type,
      tx.source_id,
      tx.buyer_id,
      tx.weight,
      tx.price_per_kg,
      tx.total_price,
      tx.added_by || "Apon Das"
    ]);
  } else if (reportType === "source_payment") {
    sheetName = "Trawler Landings";
    headers = ["Settlement Date", "Payment ID", "Source Trawler ID", "Delivered Weight (KG)", "Agreed Landing Rate (৳)", "Estimated Sales Total (৳)", "Broker Fee 5% Commission (৳)", "Net Share Settled Cash (৳)", "Status"];
    
    const payments = data.source_payments || [];
    rows = payments.map(p => [
      p.date || dateStr,
      p.id,
      p.source_id,
      p.total_kg,
      p.rate_per_kg,
      p.sale_total,
      p.commission,
      p.amount_paid_to_source,
      p.is_settled ? "SETTLED" : "UNSETTLED"
    ]);
  } else if (reportType === "collection") {
    sheetName = "Revenue Collections";
    headers = ["Payment Date", "Receipt ID", "Buyer Client ID", "Prior Rollover Outstanding (৳)", "Current Billings (৳)", "Amount Received (৳)", "Approved In Vault", "Current Post-trade Balance (৳)"];
    
    const collections = data.daily_collections || [];
    rows = collections.map(col => {
      const buyer = data.buyers.find(b => b.id === col.buyer_id);
      return [
        col.date || dateStr,
        col.id,
        buyer?.nickname || `ID: ${col.buyer_id}`,
        col.total_owed_today - col.amount_paid,
        col.total_owed_today,
        col.amount_paid,
        col.is_approved ? "APPROVED" : "PENDING",
        buyer?.lifetime_debt || 0
      ];
    });
  } else {
    sheetName = "Buyer Account Invoices";
    headers = ["Buyer Nickname", "Starting Rollover Debt (৳)", "Today Purchases Billings (৳)", "Total Payments Paid (৳)", "End-of-day Outstanding Balance (৳)", "Limits Standard (৳)"];
    
    const buyers = data.buyers || [];
    rows = buyers.map(b => {
      const bTxList = (data.transactions || []).filter(tx => tx.buyer_id === b.id);
      const todayTotal = bTxList.reduce((sum, tx) => sum + tx.total_price, 0);
      const bColList = (data.daily_collections || []).filter(c => c.buyer_id === b.id);
      const todayPaid = bColList.reduce((sum, c) => sum + c.amount_paid, 0);
      const startDebt = Math.max(0, b.lifetime_debt - todayTotal + todayPaid);
      return [
        b.nickname,
        startDebt,
        todayTotal,
        todayPaid,
        b.lifetime_debt,
        b.credit_limit
      ];
    });
  }

  // Combine title
  const spreadsheetTitle = `New Fish Center - ${sheetName} Register [2026-06-09]`;
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
    rowsAdded
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
  mimeType: string = "text/plain"
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

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Failed to upload to Google Drive: ${errorDetails.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  };
}

export function constructPlainReportText(data: NFCData, reportType: "auction" | "source_payment" | "collection" | "collection_slip"): string {
  const dateStr = "2026-06-09";
  let txt = `========================================================================\n`;
  txt += `                      NEW FISH CENTER WHOLESALE ARAT                     \n`;
  txt += `                PORT AUTHORITIES TRADE LEDGER REPORT SERVICES            \n`;
  txt += `========================================================================\n`;
  txt += `Report Type: ${reportType.toUpperCase()} JOURNAL\n`;
  txt += `Log Date: ${dateStr}\n`;
  txt += `Generated Timestamp: ${new Date().toLocaleTimeString()}\n`;
  txt += `------------------------------------------------------------------------\n\n`;

  if (reportType === "auction") {
    txt += `DAILY AUCTION DISPATCH ENTRIES:\n`;
    txt += `ID          | TRAWLER   | BUYER COMPANY         | FISH SPECIES        | KG   | RATE | TOTAL\n`;
    txt += `------------+-----------+-----------------------+---------------------+------+------+---------\n`;
    const transactions = data.transactions || [];
    transactions.forEach(tx => {
      const b = data.buyers.find(x => x.id === tx.buyer_id);
      const s = data.sources.find(x => x.id === tx.source_id);
      txt += `${String(tx.id).padEnd(11)} | ${String(s?.name || tx.source_id).substring(0,9).padEnd(9)} | ${String(b?.nickname || tx.buyer_id).substring(0,21).padEnd(21)} | ${String(tx.fish_type).substring(0,19).padEnd(19)} | ${String(tx.weight).padStart(4)} | ${String(tx.price_per_kg).padStart(4)} | ৳${String(tx.total_price).padStart(7)}\n`;
    });
    
    const totalVolume = transactions.reduce((sum, tx) => sum + tx.total_price, 0);
    const totalWeight = transactions.reduce((sum, tx) => sum + tx.weight, 0);
    txt += `------------------------------------------------------------------------\n`;
    txt += `TOTAL CRATES RECORDED: ${transactions.length}\n`;
    txt += `TOTAL WEIGHT METRICS : ${totalWeight} KG\n`;
    txt += `TOTAL SALES REVENUE  : ৳${totalVolume}\n`;
  } else if (reportType === "source_payment") {
    txt += `TRAWLER commission & NET PAYOUT SETTLEMENTS:\n`;
    txt += `ID          | VESSEL SOURCE NAME            | TOTAL WEIGHT | SALE SUM | COMM (5%) | NET PAYOUT\n`;
    txt += `------------+-------------------------------+--------------+----------+-----------+------------\n`;
    const payments = data.source_payments || [];
    payments.forEach(p => {
      const s = data.sources.find(x => x.id === p.source_id);
      txt += `${String(p.id).padEnd(11)} | ${String(s?.name || p.source_id).substring(0, 29).padEnd(29)} | ${String(p.total_kg).padStart(8)} | ৳${String(p.sale_total).padStart(6)} | ৳${String(p.commission).padStart(7)} | ৳${String(p.amount_paid_to_source).padStart(9)}\n`;
    });
    
    const totalCommission = payments.reduce((sum, p) => sum + p.commission, 0);
    const totalPayouts = payments.reduce((sum, p) => sum + p.amount_paid_to_source, 0);
    txt += `------------------------------------------------------------------------\n`;
    txt += `TOTAL LANDINGS REGISTERED : ${payments.length}\n`;
    txt += `TOTAL SYSTEM COMMISSIONS  : ৳${totalCommission}\n`;
    txt += `TOTAL DISTRIBUTED PAYOUT  : ৳${totalPayouts}\n`;
  } else if (reportType === "collection") {
    txt += `DAILY CASH Vault & DEBT PORTFOLIO LOGS:\n`;
    txt += `RECEIPT ID  | BUYER ACCOUNT NAME    | PREV DEBT | COLS TODAY | COLLECTED | VAULT STATUS\n`;
    txt += `------------+-----------------------+-----------+------------+-----------+--------------\n`;
    const collections = data.daily_collections || [];
    collections.forEach(col => {
      const b = data.buyers.find(x => x.id === col.buyer_id);
      txt += `${String(col.id).padEnd(11)} | ${String(b?.nickname || col.buyer_id).substring(0,21).padEnd(21)} | ৳${String(col.total_owed_today - col.amount_paid).padStart(7)} | ৳${String(col.total_owed_today).padStart(8)} | ৳${String(col.amount_paid).padStart(7)} | ${col.is_approved ? "APPROVED (VAULT)" : "PENDING"}\n`;
    });
    
    const approvedCash = collections.filter(c => c.is_approved).reduce((sum, c) => sum + c.amount_paid, 0);
    const pendingCash = collections.filter(c => !c.is_approved).reduce((sum, c) => sum + c.amount_paid, 0);
    txt += `------------------------------------------------------------------------\n`;
    txt += `APPROVED REVENUE (IN VAULT): ৳${approvedCash}\n`;
    txt += `PENDING CASHIER DRAFTS    : ৳${pendingCash}\n`;
  } else {
    txt += `BUYER ACCOUNT STATUS SLIPS SUMMARY:\n`;
    const buyers = data.buyers || [];
    buyers.forEach((b, idx) => {
      const bTxList = (data.transactions || []).filter(tx => tx.buyer_id === b.id);
      const bColList = (data.daily_collections || []).filter(c => c.buyer_id === b.id);
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
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title
    })
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Failed to create Google Doc: ${errorDetails.error?.message || res.statusText}`);
  }

  const d = await res.json();
  return d.documentId;
}

export async function insertDocumentText(documentId: string, text: string): Promise<void> {
  const token = getWorkspaceToken();
  if (!token) throw new Error("Google account is not connected.");

  const requests = [
    {
      insertText: {
        location: { index: 1 },
        text
      }
    }
  ];

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests
    })
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Failed updating Doc text: ${errorDetails.error?.message || res.statusText}`);
  }
}

export async function syncReportToGoogleDocs(data: NFCData, reportType: "auction" | "source_payment" | "collection" | "collection_slip"): Promise<DocsDraftResult> {
  const formattedText = constructPlainReportText(data, reportType);
  const titles = {
    auction: "New Fish Center - Daily Auction Log [2026-06-09]",
    source_payment: "New Fish Center - Trawler Commission settlements [2026-06-09]",
    collection: "New Fish Center - Daily Revenue & Cash Logs [2026-06-09]",
    collection_slip: "New Fish Center - Buyer Invoices [2026-06-09]"
  };
  
  const title = titles[reportType];
  const documentId = await createGoogleDocument(title);
  await insertDocumentText(documentId, formattedText);

  return {
    documentId,
    documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
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
  endTime: string
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
    colorId: "2" // Sea Green / Blue for maritime events
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(event)
  });

  if (!res.ok) {
    const errorDetails = await res.json().catch(() => ({}));
    throw new Error(`Calendar event creation failed: ${errorDetails.error?.message || res.statusText}`);
  }

  return await res.json();
}

/**
 * Sync active vessel arrivals as calendar events to organize work shifts
 */
export async function syncSourcesToGoogleCalendar(data: NFCData): Promise<CalendarLandingSyncResult> {
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
    const startTime = "2026-06-09T08:00:00+06:00"; // Market opens early morning 8 AM
    const endTime = "2026-06-09T13:00:00+06:00";   // Main landings finish by noon

    await createCalendarEvent(summary, description, startTime, endTime);
    eventsCreated++;
  }

  return {
    eventsCreated
  };
}
