import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DocEntry = { name: string; type?: string; dataUrl?: string };

function hex(c: [number, number, number]) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const NAVY: [number, number, number] = [30, 58, 138];

function header(doc: jsPDF, title: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text("safey", 14, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Safey Medical Devices Private", w / 2 + 20, 18);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(14, 23, w - 14, 23);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text(title, w / 2, 34, { align: "center" });
  return 42;
}

function footer(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Safey Medical Devices Private Limited · Certified per ISO 13485", w / 2, h - 10, {
    align: "center",
  });
}

/** Trigger a browser download for a base64/plain URL */
export function triggerDownload(dataUrl: string | undefined, filename: string) {
  if (!dataUrl) return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Raw material PDF: summary sheet + the COA / PO / Invoice PDFs.
 * Returns nothing; fires downloads synchronously from the user click.
 */
export function downloadRawMaterialPdf(pdfData: {
  batch_number: string;
  material_type: string | null;
  vendor_name?: string | null;
  coa_number?: string | null;
  po_number?: string | null;
  invoice_number?: string | null;
  coa_documents?: string | null;
  po_documents?: string | null;
  invoice_documents?: string | null;
}) {
  const doc = new jsPDF();
  const y = header(doc, "Raw Material Details");

  const rows: [string, string][] = [
    ["Vendor Name", pdfData.vendor_name ?? "—"],
    ["Raw Material", pdfData.batch_number],
    ["Material Type", pdfData.material_type ?? "—"],
    ["COA Number", pdfData.coa_number ?? "—"],
    ["PO Number", pdfData.po_number ?? "—"],
    ["Invoice Number", pdfData.invoice_number ?? "—"],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: rows,
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 10 },
  });
  footer(doc);
  doc.save(`RawMaterial_${pdfData.batch_number}.pdf`);

  // Attached PO / Invoice / COA documents
  const docs: { key: string; label: string }[] = [
    { key: "coa_documents", label: "COA" },
    { key: "po_documents", label: "PO" },
    { key: "invoice_documents", label: "Invoice" },
  ];
  for (const { key, label } of docs) {
    const raw = pdfData[key as keyof typeof pdfData] as string | null;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as DocEntry[];
      parsed.forEach((d, i) => {
        if (d.dataUrl) triggerDownload(d.dataUrl, `${label}_${pdfData.batch_number}_${i + 1}.pdf`);
      });
    } catch {
      /* not JSON — ignore */
    }
  }
}

/**
 * Part PDF: part batch details table + inspection form results table.
 */
export function downloadPartPdf(pdfData: {
  batch_number: string;
  part_name: string | null;
  quantity: number;
  raw_material?: string | null;
  masterbatch?: string | null;
  created_at?: string | null;
  inspection?: {
    form_id?: string | null;
    overall_result?: string | null;
    inspection_date?: string | null;
    qc_rows?: unknown;
  } | null;
}) {
  const doc = new jsPDF();
  let y = header(doc, "Part Batch Details");

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Batch", pdfData.batch_number],
      ["Part", pdfData.part_name ?? "—"],
      ["Qty", String(pdfData.quantity)],
      ["Raw Material", pdfData.raw_material ?? "—"],
      ["Masterbatch", pdfData.masterbatch ?? "—"],
      ["Date", pdfData.created_at ? pdfData.created_at.slice(0, 10) : "—"],
    ],
    headStyles: { fillColor: NAVY, textColor: 255 },
    styles: { fontSize: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text("Inspection Form Result", 14, y);
  y += 4;

  const insp = pdfData.inspection;
  if (!insp) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("No inspection record submitted for this batch.", 14, y + 8);
  } else {
    autoTable(doc, {
      startY: y + 6,
      head: [["Field", "Value"]],
      body: [
        ["Form ID", insp.form_id ?? "—"],
        ["Inspection Date", insp.inspection_date ?? "—"],
        ["Result", insp.overall_result ?? "—"],
      ],
      headStyles: { fillColor: NAVY, textColor: 255 },
      styles: { fontSize: 10 },
    });

    const qc = (insp.qc_rows ?? []) as Record<string, unknown>[];
    if (Array.isArray(qc) && qc.length > 0) {
      y = (doc as any).lastAutoTable.finalY + 10;
      autoTable(doc, {
        startY: y,
        head: [["Part #", "A", "B", "C", "Result"]],
        body: qc.map((r, i) => [
          String(r.part_num ?? i + 1),
          String(r.a_measured ?? r.a_actual ?? "—"),
          String(r.b_measured ?? r.b_actual ?? "—"),
          String(r.c_measured ?? r.c_actual ?? "—"),
          String(r.result ?? "—"),
        ]),
        headStyles: { fillColor: NAVY, textColor: 255 },
        styles: { fontSize: 8 },
      });
    }
  }

  footer(doc);
  doc.save(`PartBatch_${pdfData.batch_number}.pdf`);
}
