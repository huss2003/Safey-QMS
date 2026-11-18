import type { CSSProperties } from "react";
// Delivery challan, laid out to match the approved Safey challan (A4).
// Rendered only while printing, so the print CSS hides everything else.

export const COMPANY = {
  name: "Safey Medical Devices Private Limited",
  address: ["PAP S 47-48, Chakan MIDC PH II, Khed, Savardari", "Pune, Maharashtra 410501, India."],
  website: "www.safeymedicaldevices.com",
  cin: "U33100PN2018PTC179969",
  gstin: "27AARCAS3211L1ZC",
  iec: "AARCAS3211L",
};

export type ChallanProduct = { productName: string; quantity: string };

export type ChallanRow = {
  invoice_number: string | null;
  customer_name: string;
  customer_address: string | null;
  ship_to_address: string | null;
  dc_no?: string | null;
  products?: ChallanProduct[] | null;
};

function lines(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// Challan number: the saved DC number, otherwise "DC-" plus the invoice's digits.
export function challanNumber(row: ChallanRow): string {
  if (row.dc_no) return row.dc_no;
  const digits = (row.invoice_number ?? "").replace(/\D/g, "").slice(-4) || "0000";
  return `DC-${digits}`;
}

function today(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function DeliveryChallan({ row }: { row: ChallanRow }) {
  const products = (row.products ?? []).filter((p) => p.productName);
  const totalQty = products.reduce((n, p) => n + (parseInt(p.quantity, 10) || 0), 0);
  // The customer name is printed once as the block heading; drop it from the address lines
  // when the saved address repeats it at the top.
  const withoutName = (addr: string[]) =>
    addr.length && addr[0].toLowerCase() === row.customer_name.trim().toLowerCase() ? addr.slice(1) : addr;
  const billLines = withoutName(lines(row.customer_address));
  const shipLines = withoutName(lines(row.ship_to_address || row.customer_address));

  return (
    <div className="print-doc-area" data-testid="delivery-challan" style={sheet}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{COMPANY.name}</div>
          {COMPANY.address.map((l) => (
            <div key={l}>{l}</div>
          ))}
          <div>{COMPANY.website}</div>
          <div>CIN: {COMPANY.cin}</div>
          <div>GSTIN: {COMPANY.gstin}</div>
          <div>IEC No. {COMPANY.iec}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: "-0.5px" }}>safey</div>
          <div style={{ fontWeight: 700, marginTop: 10 }}>D.c No- {challanNumber(row)}</div>
          <div style={{ fontWeight: 700 }}>Date- {today()}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
        <Block title="Bill to-" name={row.customer_name} lines={billLines} />
        <Block title="Ship to-" name={row.customer_name} lines={shipLines} />
      </div>

      <hr style={{ border: 0, borderTop: "2px solid #000", margin: "24px 0 12px" }} />
      <div style={{ textAlign: "center", letterSpacing: 2, fontSize: 15 }}>DELIVERY CHALLAN</div>

      <table style={table}>
        <thead>
          <tr style={{ background: "#4d4d4d", color: "#fff" }}>
            <th style={cell}>Sr. No.</th>
            <th style={cell}>DESCRIPTION</th>
            <th style={cell}>Qty</th>
            <th style={cell}>Box No.</th>
            <th style={cell}>Dimensions (LWH)</th>
            <th style={cell}>Weight (Kgs)</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
              <td style={cell}>{p.productName}</td>
              <td style={{ ...cell, textAlign: "center" }}>{p.quantity}</td>
              <td style={{ ...cell, textAlign: "center" }}>1</td>
              <td style={cell} />
              <td style={cell} />
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ ...cell, fontWeight: 700 }}>Total qty of the product</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: "center" }}>{totalQty}</td>
            <td colSpan={3} style={cell} />
          </tr>
          <tr>
            <td colSpan={2} style={{ ...cell, fontWeight: 700 }}>Total packages</td>
            <td style={{ ...cell, fontWeight: 700, textAlign: "center" }}>{products.length ? 1 : 0}</td>
            <td colSpan={3} style={cell} />
          </tr>
        </tbody>
      </table>

      <div style={{ border: "1px solid #000", padding: "8px 10px", marginTop: 14 }}>
        <div style={{ fontWeight: 700 }}>Terms &amp; Conditions</div>
        <div>1) Delivery term- Door delivery.</div>
        <div>2) Country of origin- India.</div>
      </div>
    </div>
  );
}

function Block({ title, name, lines: addr }: { title: string; name: string; lines: string[] }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ background: "#d9d9d9", fontWeight: 700, padding: "3px 6px" }}>{title}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>{name}</div>
      {addr.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

const sheet: CSSProperties = {
  width: "210mm",
  height: "297mm",
  overflow: "hidden",
  boxSizing: "border-box",
  padding: "14mm 14mm",
  background: "#fff",
  color: "#000",
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 12,
  lineHeight: 1.35,
};

const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 16,
  fontSize: 12,
};

const cell: CSSProperties = {
  border: "1px solid #000",
  padding: "5px 6px",
  textAlign: "left",
};
