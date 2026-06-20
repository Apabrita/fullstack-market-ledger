import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import Papa from 'papaparse';

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

