/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { uploadFileToGoogleDrive } from "./workspace";
import { loadAll, NFCData } from "../db";

export interface BackupResult {
  fileId: string;
  webViewLink: string;
  bytes: number;
}

/**
 * Perform a full snapshot of the complete local/Firebase state
 * and back it up as a pure JSON file on Google Drive for Day Closing.
 */
export async function performDayClosingBackup(): Promise<BackupResult> {
  // Extract latest full snapshot
  const dbSnapshot: NFCData = await loadAll();

  // Create JSON string
  const serializedSnapshot = JSON.stringify(dbSnapshot, null, 2);
  const bytes = new Blob([serializedSnapshot]).size;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `NFC_Database_Closing_Snapshot_${timestamp}.json`;

  try {
    const res = await uploadFileToGoogleDrive(fileName, serializedSnapshot, "application/json");
    return {
      fileId: res.fileId,
      webViewLink: res.webViewLink,
      bytes
    };
  } catch (err: any) {
    throw new Error(`Day Closing Backup failed: ${err.message}`);
  }
}
