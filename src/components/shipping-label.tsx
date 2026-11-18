// Shipping label: "To" = customer ship-to address, "From" = Safey Medical Devices.
// Fixed 105 mm x 50 mm proportion. The To text is measured in the browser and the font
// steps down until it fits the border. On narrow screens the whole label scales down
// to fit its container; printing always uses full size.

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
const MAX_FONT_PX = 11;
const MIN_FONT_PX = 6;
const FROM_PX = 11; // sender block is a fixed size, so the To text never shrinks for it
const LOGO_PX = 24;
const LINE_HEIGHT = 1.28;

function splitAddress(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function ShippingLabel({
  shipTo,
  customerName,
}: {
  shipTo: string | null | undefined;
  customerName: string | null | undefined;
}) {
  // Bold: the customer name. Regular: the ship-to address, without a repeat of the name.
  const name = (customerName ?? "").trim();
  const all = splitAddress(shipTo ?? "");
  const addressLines = all.filter((l) => l.toLowerCase() !== name.toLowerCase());
  const recipient = name || "Recipient";
  const lines = all;
  const labelRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fontPx, setFontPx] = useState(MAX_FONT_PX);
  const [scale, setScale] = useState(1);
  const key = lines.join("\n");

  // Shrink the To text until it fits its column and the label.
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
  }, [key, recipient]);

  // Scale the whole label down when its container is narrower than the label.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => setScale(Math.min(1, wrap.clientWidth / LABEL_W_PX));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="shipping-label-wrap"
      style={{ width: "100%", maxWidth: `${LABEL_W_PX}px`, height: `${LABEL_H_PX * scale}px` }}
    >
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
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={leftRef}
          style={{ width: `${LEFT_COL_FRACTION * 100}%`, minWidth: 0, overflowWrap: "anywhere", overflow: "hidden" }}
        >
          <div style={{ fontWeight: 700 }}>To,</div>
          <div data-testid="label-to-bold" style={{ fontWeight: 700 }}>{recipient}</div>
          <div data-testid="label-to-lines">
            {addressLines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>

        <div
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
    </div>
  );
}
