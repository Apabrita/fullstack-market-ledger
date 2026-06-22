import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function downloadCSV(dataArray: any[], fileName: string) {
  try {
    const csvData = Papa.unparse(dataArray);
    
    if (Capacitor.isNativePlatform()) {
      // For Capacitor native share
      const base64Data = btoa(unescape(encodeURIComponent(csvData)));

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: fileName,
        url: savedFile.uri,
      });
    } else {
      // Web fallback
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export CSV file.");
  }
}

export async function downloadXLSX(sheets: { name: string; data: any[] }[], fileName: string) {
  try {
    const wb = XLSX.utils.book_new();

    for (const sheet of sheets) {
      const ws = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // excel limits sheet name to 31 chars
    }

    if (Capacitor.isNativePlatform()) {
      // For Capacitor native share, generate base64
      const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: fileName,
        url: savedFile.uri,
      });
    } else {
      // Web fallback
      XLSX.writeFile(wb, fileName);
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export XLSX file.");
  }
}

