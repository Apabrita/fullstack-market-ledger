import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const shareAsPDF = async (
  elementId: string,
  filename: string,
  title: string,
  text: string,
  action: 'share' | 'download' | 'print' = 'share'
) => {
  const originalElement = document.getElementById(elementId);
  if (!originalElement) {
    alert("Canvas element not found.");
    return false;
  }

  // Create a temporary container that is visually on-screen to prevent browser culling,
  // but layered so it doesn't disrupt the user (or just flash it).
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'fixed';
  tempContainer.style.top = '0';
  tempContainer.style.left = '0';
  // Use a high z-index to overlay, ensuring it renders. User will see a brief flash of the doc, which is good feedback.
  tempContainer.style.zIndex = '999999';
  tempContainer.style.width = '100vw';
  tempContainer.style.height = '100vh';
  tempContainer.style.overflow = 'auto'; // allow it to scroll its content natively
  tempContainer.style.backgroundColor = '#ffffff';

  // Clone the element to avoid mutating the React tree dangerously
  const clone = originalElement.cloneNode(true) as HTMLElement;
  
  // Force desktop-width layout bounds so flex/grids don't collapse on mobile screens
  clone.style.setProperty('width', '1000px', 'important'); 
  clone.style.removeProperty('height');
  clone.style.setProperty('height', 'auto', 'important'); 
  clone.style.setProperty('overflow', 'visible', 'important'); 
  clone.style.setProperty('position', 'relative', 'important'); 
  clone.style.removeProperty('max-height');
  clone.style.setProperty('max-height', 'none', 'important');
  clone.style.margin = '0 auto'; // Centered for the visual flash
  
  // Temporarily remove print:hidden elements or buttons on the clone
  const hiddenElements: HTMLElement[] = Array.from(clone.querySelectorAll('.print\\:hidden, button'));
  hiddenElements.forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  tempContainer.appendChild(clone);
  document.body.appendChild(tempContainer);

  // Temporarily toggle off dark mode globally if active so it's black-on-white
  const htmlElement = document.documentElement;
  const wasDark = htmlElement.classList.contains('theme-dark') || htmlElement.classList.contains('dark');
  if (wasDark) {
    htmlElement.classList.remove('theme-dark', 'dark');
  }

  try {
    // ⬇️ Lower the scale slightly for mobile to aggressively prevent OOM (Out of Memory) crashes on long scrollable print views.
    const isMobile = Capacitor.isNativePlatform() || window.innerWidth < 768;
    const canvasScale = isMobile ? 1.5 : 2;

    // A small delay to let image fetching or fonts process on the cloned node
    await new Promise(resolve => setTimeout(resolve, 100));

    // Use html-to-image instead of html2canvas to natively support OKLCH and modern CSS in webview
    const imgDataUrl = await toJpeg(clone, {
      quality: 1.0,
      backgroundColor: '#ffffff',
      pixelRatio: canvasScale, // Safe resolution to prevent crashes
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
        width: '1000px',
      }
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgProps = pdf.getImageProperties(imgDataUrl);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = imgProps.width;
    const canvasHeight = imgProps.height;
    
    if (!canvasWidth || !canvasHeight) {
      throw new Error("Generated image has invalid dimensions");
    }

    const pdfHeight = (canvasHeight * pdfWidth) / canvasWidth;

    let heightLeft = pdfHeight;
    let position = 0;
    let pageNum = 1;

    pdf.addImage(imgDataUrl, 'JPEG', 0, position, pdfWidth, pdfHeight);
    
    // Add page number to first page
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`Page ${pageNum}`, pdfWidth / 2, pageHeight - 5, { align: 'center' });
    
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgDataUrl, 'JPEG', 0, position, pdfWidth, pdfHeight);
      pageNum++;
      
      // Blank out the top margin if there is content overflowing from previous
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfWidth, 10, 'F');
      
      pdf.text(`Page ${pageNum}`, pdfWidth / 2, pageHeight - 5, { align: 'center' });
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = pdf.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        if (action === 'share' || true) { 
          await Share.share({
            title,
            text,
            url: savedFile.uri,
            dialogTitle: title
          });
        }
      } catch (err) {
        console.error("Native share error", err);
      }
    } else {
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      if (action === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title,
            text,
            files: [file]
          });
        } catch (err) {
          // User probably cancelled
        }
      } else if (action === 'download' || action === 'print' || action === 'share') {
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      }
    }
    return true;
  } catch (error: any) {
    console.error("PDF generation error: ", error);
    alert("Failed to generate PDF. Falling back to simple print... Error: " + (error?.message || error?.toString() || "Unknown Error"));
    return false;
  } finally {
    if (document.body.contains(tempContainer)) {
      document.body.removeChild(tempContainer);
    }
    if (wasDark) {
      htmlElement.classList.add('theme-dark', 'dark');
    }
  }
};

