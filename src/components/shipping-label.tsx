// Shipping label: "To" = customer ship-to address, "From" = Safey Medical Devices.
// Fixed 105 mm x 50 mm (same 2.1:1 proportion as the approved label). After each
// render the To text is measured in the browser and the font steps down until
// both columns fit inside the border, so long or many-line addresses never
// spill out of the label.

import { useLayoutEffect, useRef, useState } from "react";

export const FROM_COMPANY = {
  name: "Safey Medical Devices",
  address: ["PAP-47&48, Sawardari, MIDC", "Rd, II, Chakan, Maharashtra", "410501"],
  contact: "8956388853",
};

const LABEL_W_PX = 397; // 105 mm at 96 dpi
const LABEL_H_PX = 189; // 50 mm at 96 dpi
const PAD_PX = 16;
const LEFT_COL_FRACTION = 0.62;
const MAX_FONT_PX = 15;
const MIN_FONT_PX = 6;
const FROM_PX = 11; // sender block is a fixed size, so the To text never shrinks for it
const LOGO_PX = 30;
const LINE_HEIGHT = 1.28;

function splitAddress(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// One-line form of the address: "a, b" with no doubled commas when a line already ends in one.
function joinLines(lines: string[]): string {
  return lines.reduce((acc, line, i) => {
    if (i === 0) return line;
    return acc.endsWith(",") ? `${acc} ${line}` : `${acc}, ${line}`;
  }, "");
}

export function ShippingLabel({ shipTo }: { shipTo: string | null | undefined }) {
  const lines = splitAddress(shipTo ?? "");
  const bold = lines.length ? joinLines(lines) : "No ship-to address saved";
  const labelRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [fontPx, setFontPx] = useState(MAX_FONT_PX);

  // Shrink the To text until it fits its column and the label; the From column is fixed-size.
  useLayoutEffect(() => {
    const label = labelRef.current;
    if (!label) return;
    const overflows = () =>
      (leftRef.current !== null && leftRef.current.scrollHeight > leftRef.current.clientHeight + 0.5) ||
      label.scrollWidth > label.clientWidth + 0.5;
    let f = MAX_FONT_PX;
    label.style.fontSize = `${f}px`;
    while (overflows() && f > MIN_FONT_PX) {
      f -= 1;
      label.style.fontSize = `${f}px`;
    }
    setFontPx(f);
  }, [bold, lines.length]);


  return (
    <div
      ref={labelRef}
      className="shipping-label"
      data-testid="shipping-label"
      style={{
        width: `${LABEL_W_PX}px`,
        height: `${LABEL_H_PX}px`,
        padding: `${PAD_PX}px`,
        boxSizing: "border-box",
        border: "3px solid #000",
        borderRadius: "34px",
        background: "#fff",
        color: "#000",
        fontFamily: '"Arial Narrow", "Liberation Sans Narrow", Arial, Helvetica, sans-serif',
        fontSize: `${fontPx}px`,
        lineHeight: LINE_HEIGHT,
        display: "flex",
        justifyContent: "space-between",
        overflow: "hidden",
      }}
    >
      <div
        ref={leftRef}
        style={{ width: `${LEFT_COL_FRACTION * 100}%`, minWidth: 0, overflowWrap: "anywhere", overflow: "hidden" }}
      >
        <div style={{ fontWeight: 700 }}>To,</div>
        <div data-testid="label-to-bold" style={{ fontWeight: 700 }}>{bold}</div>
        <div data-testid="label-to-lines">
          {lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>

      <div
        ref={rightRef}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "flex-end",
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: `${LOGO_PX}px`, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
          safey<sup style={{ fontSize: "0.4em" }}>®</sup>
        </div>
        <div data-testid="label-from" style={{ width: "100%", overflowWrap: "anywhere", fontSize: `${FROM_PX}px` }}>
          <div style={{ fontWeight: 700 }}>From,</div>
          <div style={{ fontWeight: 700 }}>{FROM_COMPANY.name}</div>
          {FROM_COMPANY.address.map((l) => (
            <div key={l}>{l}</div>
          ))}
          <div style={{ fontWeight: 700 }}>Contact: {FROM_COMPANY.contact}</div>
        </div>
      </div>
    </div>
  );
}
