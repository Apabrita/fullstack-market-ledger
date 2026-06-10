import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const shareAsPDF = async (
  elementId: string,
  filename: string,
  title: string,
  text: string,
  action: 'share' | 'download' | 'print' = 'share'
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("Canvas element not found.");
    return false;
  }

  // Save original styles
  const originalWidth = element.style.width;
  const originalHeight = element.style.height;
  const originalOverflow = element.style.overflow;
  const originalPosition = element.style.position;
  const originalMaxHeight = element.style.maxHeight;
  const originalColor = element.style.color;
  const originalBg = element.style.backgroundColor;

  // Temporarily force styles on the actual element for full rendering
  element.style.width = '1000px'; // fixed wide width for a desktop-like render on arbitrary mobile viewports
  element.style.height = 'auto'; // allow it to grow to full content height
  element.style.overflow = 'visible'; // don't clip content
  element.style.position = 'relative'; 
  element.style.maxHeight = 'none';

  // Temporarily remove print:hidden elements or buttons during render
  const hiddenElements: HTMLElement[] = Array.from(element.querySelectorAll('.print\\:hidden, button'));
  hiddenElements.forEach(el => {
    el.style.setProperty('display', 'none', 'important');
  });

  // Temporarily toggle off dark mode globally if active so it's black-on-white
  const htmlElement = document.documentElement;
  const wasDark = htmlElement.classList.contains('theme-dark') || htmlElement.classList.contains('dark');
  if (wasDark) {
    htmlElement.classList.remove('theme-dark', 'dark');
  }

  try {
    const canvas = await html2canvas(element, {
      scale: window.devicePixelRatio > 1 ? 2 : 1.5, // optimal resolution vs memory limit
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1000,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Use multiple pages if content exceeds one page height
    const pageHeight = pdf.internal.pageSize.getHeight();
    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');
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
      // Fallback to direct download if share fails or download explicitly requested
      pdf.save(filename);
    }
    return true;
  } catch (error) {
    console.error("PDF generation error: ", error);
    alert("Failed to generate PDF file.");
    return false;
  } finally {
    // Restore original styles
    element.style.width = originalWidth;
    element.style.height = originalHeight;
    element.style.overflow = originalOverflow;
    element.style.position = originalPosition;
    element.style.maxHeight = originalMaxHeight;
    element.style.color = originalColor;
    element.style.backgroundColor = originalBg;

    hiddenElements.forEach(el => {
      el.style.removeProperty('display');
    });

    if (wasDark) {
      htmlElement.classList.add('theme-dark', 'dark');
    }
  }
};

