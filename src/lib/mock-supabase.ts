// In-memory stand-in for the parts of the Supabase JS client used by the
// Delivery, New Shipment, Customers and Register UDI screens.
// Enabled with VITE_MOCK_DATA=true. Data lives in localStorage so it survives
// page reloads; clear the "safey-mock-db" key to reset to the seed data.

type Row = Record<string, any>;
type Store = Record<string, Row[]>;

const STORE_KEY = "safey-mock-db";
const now = () => new Date().toISOString();
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function seed(): Store {
  const t = now();
  return {
    products: [
      { id: "prod-1", product_name: "Surgical Scalpel Pro", product_code: "SSP-100", description: null, gtin: "08901234567890", is_active: true, created_at: t },
      { id: "prod-2", product_name: "Catheter Guide Wire", product_code: "CGW-200", description: null, gtin: "08901234567906", is_active: true, created_at: t },
    ],
    customer_addresses: [
      { id: "addr-1", customer_name: "Apex Medical Clinic", address_type: "bill", address: "12 Lake Road, Pune 411001", is_default: true, contact_number: "+91 20 1111 1111", email_address: "accounts@apex.example", created_at: t },
      { id: "addr-2", customer_name: "Apex Medical Clinic", address_type: "ship", address: "Block B, MIDC Hinjewadi, Pune 411057", is_default: true, contact_number: null, email_address: null, created_at: t },
      { id: "addr-3", customer_name: "Apex Medical Clinic", address_type: "ship", address: "Warehouse 4, Chakan, Pune 410501", is_default: false, contact_number: null, email_address: null, created_at: t },
      { id: "addr-4", customer_name: "Northstar Hospital", address_type: "bill", address: "45 Park Street, Mumbai 400001", is_default: true, contact_number: "+91 22 2222 2222", email_address: "ap@northstar.example", created_at: t },
      { id: "addr-5", customer_name: "Sunrise Diagnostics", address_type: "bill", address: "7 MG Road, Bengaluru 560001", is_default: true, contact_number: null, email_address: null, created_at: t },
    ],
    udi_registrations: [
      { id: "ship-1", invoice_number: "INV-260001", customer_name: "Northstar Hospital", customer_address: "45 Park Street, Mumbai 400001", ship_to_address: null, date_logged: "2026-11-10", invoice_date: "2026-11-10", warranty_term: "2_year", products: [], stage: 0, stage_updated_at: "2026-11-10T09:00:00Z", delivery_tracking_code: null, delivery_service_provider: null, dc_no: null, warranty_term_months: null, is_draft: false, invoice_pdf_path: null, invoice_pdf_name: null, created_at: "2026-11-10T09:00:00Z" },
      { id: "ship-2", invoice_number: "INV-260002", customer_name: "Sunrise Diagnostics", customer_address: "7 MG Road, Bengaluru 560001", ship_to_address: null, date_logged: "2026-11-08", invoice_date: "2026-11-08", warranty_term: "1_year", products: [], stage: 1, stage_updated_at: "2026-11-09T11:00:00Z", delivery_tracking_code: "DEL-88421", delivery_service_provider: "BlueDart", dc_no: null, warranty_term_months: null, is_draft: false, invoice_pdf_path: null, invoice_pdf_name: null, created_at: "2026-11-08T10:00:00Z" },
      { id: "ship-3", invoice_number: "INV-260003", customer_name: "Apex Medical Clinic", customer_address: "12 Lake Road, Pune 411001", ship_to_address: "Block B, MIDC Hinjewadi, Pune 411057", date_logged: "2026-11-05", invoice_date: "2026-11-05", warranty_term: "3_year", products: [], stage: 2, stage_updated_at: "2026-11-07T15:00:00Z", delivery_tracking_code: "DEL-77310", delivery_service_provider: "DTDC", dc_no: null, warranty_term_months: null, is_draft: false, invoice_pdf_path: null, invoice_pdf_name: null, created_at: "2026-11-05T12:00:00Z" },
    ],
  };
}

function loadStore(): Store {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORE_KEY) : null;
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to seed */
  }
  return seed();
}

let store: Store = loadStore();

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* quota or private mode: keep in memory only */
  }
}

// Uniqueness rules that the real database enforces.
function checkUnique(table: string, row: Row, selfId: string | null) {
  const others = (store[table] ?? []).filter((r) => r.id !== selfId);
  if (table === "udi_registrations" && row.invoice_number) {
    if (others.some((r) => r.invoice_number === row.invoice_number)) {
      throw { code: "23505", message: `duplicate key value violates unique constraint "udi_registrations_invoice_number_key"` };
    }
  }
  if (table === "customer_addresses" && row.address_type === "bill" && row.customer_name) {
    const key = String(row.customer_name).trim().toLowerCase();
    if (others.some((r) => r.address_type === "bill" && String(r.customer_name).trim().toLowerCase() === key)) {
      throw { code: "23505", message: "duplicate key value violates unique constraint" };
    }
  }
}

const TABLE_DEFAULTS: Record<string, () => Row> = {
  udi_registrations: () => ({ invoice_number: null, customer_name: "", customer_address: null, ship_to_address: null, date_logged: null, invoice_date: null, warranty_term: null, products: [], stage: 0, stage_updated_at: now(), delivery_tracking_code: null, delivery_service_provider: null, dc_no: null, warranty_term_months: null, is_draft: false, invoice_pdf_path: null, invoice_pdf_name: null, verification_photos: {} }),
  customer_addresses: () => ({ is_default: false, contact_number: null, email_address: null }),
};

class MockQuery implements PromiseLike<{ data: any; error: any }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Array<(r: Row) => boolean> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private payload: any = null;
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private table: string) {}

  select(_cols?: string) {
    if (this.op === "select") return this;
    this.returning = true;
    return this;
  }
  insert(p: any) {
    this.op = "insert";
    this.payload = p;
    return this;
  }
  update(p: any) {
    this.op = "update";
    this.payload = p;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: any) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  is(col: string, val: any) {
    this.filters.push((r) => (r[col] ?? null) === val);
    return this;
  }
  in(col: string, vals: any[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  ilike(col: string, pattern: string) {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private exec(): { data: any; error: any } {
    const rows = (store[this.table] ??= []);
    const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));
    let data: any = null;
    let error: any = null;
    try {
      if (this.op === "select") {
        let out = matches();
        for (let i = this.orders.length - 1; i >= 0; i--) {
          const { col, asc } = this.orders[i];
          out = [...out].sort((a, b) => {
            const x = a[col] ?? "";
            const y = b[col] ?? "";
            return x < y ? (asc ? -1 : 1) : x > y ? (asc ? 1 : -1) : 0;
          });
        }
        if (this.limitN !== null) out = out.slice(0, this.limitN);
        data = clone(out);
      } else if (this.op === "insert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const added = items.map((p: Row) => {
          const row: Row = { id: uid(), created_at: now(), ...(TABLE_DEFAULTS[this.table]?.() ?? {}), ...p };
          checkUnique(this.table, row, null);
          return row;
        });
        rows.push(...added);
        data = this.returning ? clone(added) : null;
        persist();
      } else if (this.op === "update") {
        const targets = matches();
        for (const r of targets) {
          const next = { ...r, ...this.payload };
          checkUnique(this.table, next, r.id);
          Object.assign(r, next);
        }
        data = this.returning ? clone(targets) : null;
        persist();
      } else {
        const targets = matches();
        store[this.table] = rows.filter((r) => !targets.includes(r));
        data = this.returning ? clone(targets) : null;
        persist();
      }
      if (this.mode === "single") {
        if (!Array.isArray(data) || data.length !== 1) {
          throw { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" };
        }
        data = data[0];
      } else if (this.mode === "maybe") {
        data = Array.isArray(data) ? data[0] ?? null : data;
      }
    } catch (e: any) {
      error = e?.code ? e : { code: "MOCK", message: String(e?.message ?? e) };
      data = null;
    }
    return { data, error };
  }

  then<R1 = { data: any; error: any }, R2 = never>(
    onfulfilled?: ((v: { data: any; error: any }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return Promise.resolve().then(() => this.exec()).then(onfulfilled, onrejected);
  }
}

// Files are kept by name only; the mock does not store the bytes.
const blobUrls: Record<string, string> = {};

export function createMockSupabase() {
  return {
    from: (table: string) => new MockQuery(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File) => {
          blobUrls[`${bucket}/${path}`] = URL.createObjectURL(file);
          return { data: { path }, error: null };
        },
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: blobUrls[`${bucket}/${path}`] ?? "" },
          error: blobUrls[`${bucket}/${path}`] ? null : { message: "Object not found" },
        }),
        remove: async (paths: string[]) => {
          for (const p of paths) delete blobUrls[`${bucket}/${p}`];
          return { data: paths, error: null };
        },
      }),
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  };
}

// Sample UDIs for the Scan UDI dialog. The lot numbers must be "In stock" in
// traceability, so the mock seeds those statuses into localStorage.
export const MOCK_UDI_SAMPLES = [
  "08901234567890(11)2026-03-01(10)LOT2401A(21)LOT2401A-1",
  "08901234567890(11)2026-03-01(10)LOT2401A(21)LOT2401A-2",
  "08901234567906(11)2026-03-01(10)LOT2401B(21)LOT2401B-1",
];

export function seedMockTraceability() {
  if (typeof localStorage === "undefined") return;
  for (const lot of ["LOT2401A", "LOT2401B"]) {
    const key = `trace-status-${lot}`;
    if (localStorage.getItem(key)) continue;
    const statuses: Record<number, string> = {};
    for (let i = 0; i < 50; i++) statuses[i] = "In stock";
    localStorage.setItem(key, JSON.stringify(statuses));
  }
}
