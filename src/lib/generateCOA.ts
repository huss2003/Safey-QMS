import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = {
  primary: [30, 58, 138] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  gray: [100, 100, 100] as [number, number, number],
};

export type BatchInfo = {
  lotNumber: string;
  dateOfManufacturing: string;
};

export type COAProduct = {
  productName: string;
  batches: BatchInfo[]; // one entry per unique batch
};

function drawHeader(doc: jsPDF, pageWidth: number, margin: number) {
  let y = 18;
  // "safey" logo — bold, dark navy blue
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.primary);
  doc.text("safey", margin, y);
  // ® superscript
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("®", margin + 22, y - 5);

  // Company name — centered, same dark blue
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.primary);
  doc.text("Safey Medical Devices Private", pageWidth / 2 + 20, y);

  // Blue separator line
  y += 5;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.black);
  doc.text("Certificate of Analysis", pageWidth / 2, y, { align: "center" });

  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gray);
  doc.text("Batch Test Report", pageWidth / 2, y, { align: "center" });

  return y + 7;
}

function drawFooter(doc: jsPDF, pageWidth: number, margin: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const y = pageHeight - 18;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text("SAFETY MEDICAL DEVICES PVT. LTD.", pageWidth / 2, y + 6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Pune 410501", pageWidth / 2, y + 10, { align: "center" });
}

// Ensure we have room; if not, add a new page with header
function ensureSpace(
  doc: jsPDF,
  currentY: number,
  needed: number,
  pageWidth: number,
  margin: number,
): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + needed < pageHeight - 25) return currentY;
  drawFooter(doc, pageWidth, margin);
  doc.addPage();
  return drawHeader(doc, pageWidth, margin);
}

function drawBatchSection(doc: jsPDF, batch: BatchInfo, startY: number, margin: number): number {
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.black);
  doc.text(`Batch - ${batch.lotNumber}`, margin, y);
  y += 6;
  doc.text(`Date of Manufacturing - ${batch.dateOfManufacturing}`, margin, y);

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Quality Tests Conducted", margin, y);

  y += 4;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Test Type", "Test Specification", "Result"]],
    body: [
      ["Mechanical Tests", "Physical Properties\nParts, Welding, Appearance", "Passed"],
      ["Bluetooth Tests", "Bluetooth connectivity and data transmission", "Passed"],
      [
        "Software tests",
        "App installation and communication\nApp Showing Results\nTest Results Accuracy (ATS Standards)",
        "Passed",
      ],
      ["Package Testing", "Contents and Package durability", "Passed"],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 4,
      textColor: COLORS.black,
      lineColor: COLORS.black,
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLORS.black,
      fontStyle: "bold",
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 100 },
      2: { cellWidth: 25, halign: "center" as const },
    },
  });

  // @ts-expect-error — jspdf-autotable adds lastAutoTable
  return (doc as any).lastAutoTable.finalY + 10;
}

function formatDateOrdinal(d: Date): string {
  const day = d.getDate();
  const suffixes = ["th", "st", "nd", "rd"];
  const suffix = suffixes[(day - 20) % 10] || suffixes[day] || suffixes[0];
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${day}${suffix} of ${month} ${d.getFullYear()}`;
}

export function generateCOA(product: COAProduct) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 25;
  const today = new Date();
  const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

  let y = drawHeader(doc, pageWidth, margin);

  // Date of COA
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.black);
  doc.text(`Date of COA - ${dateStr}`, pageWidth - margin, y, { align: "right" });
  y += 10;

  // One section per batch — add page if needed
  for (const batch of product.batches) {
    y = ensureSpace(doc, y, 100, pageWidth, margin);
    y = drawBatchSection(doc, batch, y, margin);
  }

  // ── Conclusion — need ~50mm ──
  y = ensureSpace(doc, y, 50, pageWidth, margin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Conclusion", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const conclusion =
    "The tests were conducted to verify that the product performs according to its intended use. Quality testing has successfully met all the established criteria, and no performance issues were identified.";
  const lines = doc.splitTextToSize(conclusion, pageWidth - 2 * margin);
  doc.text(lines, margin, y);
  y += lines.length * 5 + 5;

  // ── Certified by — need ~30mm ──
  y = ensureSpace(doc, y, 30, pageWidth, margin);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Certified by", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const certData = [
    ["Authorized By", "Shabbir Moiyed"],
    ["Title", "Regulatory affairs and Quality Assurance"],
    ["Date", formatDateOrdinal(today)],
  ];

  certData.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 35, y);
    y += 6;
  });

  // ── Footer on last page ──
  drawFooter(doc, pageWidth, margin);

  const filename = `COA-${product.productName.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

export function generateAllCOAs(products: COAProduct[]) {
  products.forEach((p) => {
    if (p.batches.length > 0) generateCOA(p);
  });
}
