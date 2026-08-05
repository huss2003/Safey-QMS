import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ScanLine, ArrowLeft, AlertTriangle, Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/register-udi")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: search.id as string | undefined,
  }),
  component: RegisterUdiPage,
});

// ── Types ──────────────────────────────────────────────────────────

type ProductOption = { id: string; product_name: string; gtin: string | null };

type ProductRow = {
  productName: string;
  productId: string;
  quantity: string;
  gtin: string;
  scannedRows: ScanRow[];
  isNew: boolean;
};

type ScanRow = {
  dateOfBatchCreation: string;
  gtin: string;
  serialNumber: string;
  lotNumber: string;
  udi: string;
};

// ── Page ───────────────────────────────────────────────────────────

function RegisterUdiPage() {
  const navigate = useNavigate();
  const { id: searchId } = Route.useSearch();
  const fetchedIdRef = useRef<string | null>(null);

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dateLogged, setDateLogged] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [warrantyTerm, setWarrantyTerm] = useState("");

  // Products
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);

  // Scan dialog
  const [scanOpen, setScanOpen] = useState(false);
  const [scanProductIndex, setScanProductIndex] = useState(-1);
  const [scanUdiInput, setScanUdiInput] = useState("");
  const [scanError, setScanError] = useState("");

  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "product" | "scan";
    pi: number;
    ri?: number;
  } | null>(null);

  // Helpers
  const warrantyLabel = (val: string) => {
    const map: Record<string, string> = {
      "1_year": "1 Year",
      "2_year": "2 Years",
      "3_year": "3 Years",
      "5_year": "5 Years",
      lifetime: "Lifetime",
    };
    return map[val] ?? val;
  };

  const isComplete =
    products.length > 0 &&
    products.every((p) => {
      const qty = parseInt(p.quantity, 10) || 0;
      return qty > 0 && p.scannedRows.length >= qty;
    });

  // Fetch manufactured products
  useEffect(() => {
    (async () => {
      const { data: batches } = await supabase
        .from("production_batches" as any)
        .select("product_id")
        .not("product_id", "is", null);
      const productIds = [
        ...new Set((batches ?? []).map((b: any) => b.product_id).filter(Boolean)),
      ];
      if (productIds.length === 0) return;
      const { data: prods } = await supabase
        .from("products")
        .select("id, product_name, gtin")
        .in("id", productIds)
        .order("product_name");
      setProductOptions((prods ?? []) as ProductOption[]);
    })();
  }, []);

  // Load existing record for edit mode
  useEffect(() => {
    if (!searchId || fetchedIdRef.current === searchId) return;
    fetchedIdRef.current = searchId;
    (async () => {
      const { data, error } = await supabase
        .from("udi_registrations" as any)
        .select("*")
        .eq("id", searchId)
        .single();
      if (error || !data) {
        toast.error("Failed to load registration");
        return;
      }
      setInvoiceNumber(data.invoice_number ?? "");
      setCustomerName(data.customer_name ?? "");
      setDateLogged(data.date_logged ?? "");
      setInvoiceDate(data.invoice_date ?? "");
      setCustomerAddress(data.customer_address ?? "");
      setWarrantyTerm(data.warranty_term ?? "");
      try {
        const parsed = JSON.parse(data.products ?? "[]");
        setProducts(parsed.map((p: any) => ({ ...p, isNew: false })));
      } catch {
        /* empty */
      }
    })();
  }, [searchId]);

  // ── Product row ops ─────────────────────────────────────────────

  const addProductRow = () => {
    setProducts([
      ...products,
      { productName: "", productId: "", quantity: "", gtin: "", scannedRows: [], isNew: true },
    ]);
  };

  const removeProductRow = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof ProductRow, value: string) => {
    const updated = [...products];
    (updated[index] as any)[field] = value;
    setProducts(updated);
  };

  const selectProduct = (index: number, productId: string) => {
    const opt = productOptions.find((o) => o.id === productId);
    const updated = [...products];
    updated[index] = {
      ...updated[index],
      productId,
      productName: opt?.product_name ?? "",
      gtin: opt?.gtin ?? "",
      scannedRows: [],
    };
    setProducts(updated);
  };

  // ── Scan dialog ────────────────────────────────────────────────

  const openScan = (index: number) => {
    if (!products[index].productId) {
      toast.error("Select a product first");
      return;
    }
    setScanProductIndex(index);
    setScanUdiInput("");
    setScanError("");
    setScanOpen(true);
  };

  const parseUdi = () => {
    const udi = scanUdiInput.trim();
    setScanError("");
    if (!udi) {
      setScanError("Enter a UDI");
      return;
    }

    const prod = products[scanProductIndex];
    const expectedGtin = prod.gtin;

    // Parse UDI: GTIN(11)Date(10)Batch(21)Batch-Serial
    const match = udi.match(/^(\d+)\(11\)([\d-]+)\(10\)(.+?)\(21\)(.+)-(\d+)$/);
    if (!match) {
      setScanError("Invalid UDI format. Expected: GTIN(11)Date(10)Batch(21)Batch-Serial");
      return;
    }

    const [, udiGtin, dateRaw, lotNumber, , serialNum] = match;

    // GTIN validation
    if (expectedGtin && udiGtin !== expectedGtin) {
      setScanError(`GTIN mismatch: UDI has ${udiGtin}, product has ${expectedGtin}`);
      return;
    }

    // ── Check traceability localStorage ──
    let udiFound = false;
    let udiStatus = "";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("trace-status-")) {
        try {
          const statuses = JSON.parse(localStorage.getItem(key) || "{}") as Record<number, string>;
          const batchFromKey = key.replace("trace-status-", "");
          if (batchFromKey === lotNumber) {
            const serialAsIndex = parseInt(serialNum, 10) - 1;
            if (statuses[serialAsIndex] !== undefined) {
              udiFound = true;
              udiStatus = statuses[serialAsIndex];
            }
          }
        } catch {
          /* empty */
        }
      }
    }

    if (!udiFound) {
      setScanError("UDI not created");
      toast.error("UDI not created");
      return;
    }

    if (udiStatus !== "In stock") {
      setScanError("The device is not present in In stock");
      toast.error("The device is not present in In stock");
      return;
    }

    // Format date to DD/MM/YYYY
    let ddMmYyyy = dateRaw;
    if (dateRaw.includes("-")) {
      const [y, m, d] = dateRaw.split("-");
      ddMmYyyy = `${d}/${m}/${y}`;
    }

    const newRow: ScanRow = {
      dateOfBatchCreation: ddMmYyyy,
      gtin: udiGtin,
      serialNumber: serialNum,
      lotNumber,
      udi,
    };

    const updated = [...products];
    updated[scanProductIndex].scannedRows = [...updated[scanProductIndex].scannedRows, newRow];
    setProducts(updated);
    setScanOpen(false);
    setScanUdiInput("");
    setScanError("");
    toast.success(`Serial ${serialNum} accepted — marked In stock`);
  };

  // ── CSV ──────────────────────────────────────────────────────

  const generateCsv = () => {
    const rows: string[] = [];
    const status = isComplete ? "complete" : "incomplete";
    const invDate = invoiceDate ? invoiceDate.split("-").reverse().join("-") : "";
    rows.push(`Invoice Number,${invoiceNumber},,,`);
    rows.push(`Customer Name,${customerName},,,`);
    rows.push(`Invoice Date,${invDate},,,`);
    rows.push(`Warranty Term,${warrantyLabel(warrantyTerm)},,,`);
    rows.push(`Status,${status},,,`);
    rows.push(`,,,,`);
    rows.push(`Product Name,UDI (Raw QR),Serial Number,Mfg. Date,LOT`);
    for (const p of products) {
      for (const r of p.scannedRows) {
        const mfgDate = r.dateOfBatchCreation.replace(/\//g, "-");
        rows.push(`${p.productName},${r.udi},${r.udi},${mfgDate},${r.lotNumber}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `udi-registration-${invoiceNumber || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Save ───────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    for (const p of products) {
      if (!p.productId) {
        toast.error("All products must be selected");
        return;
      }
      const qty = parseInt(p.quantity, 10) || 0;
      if (qty <= 0) {
        toast.error(`${p.productName}: quantity must be at least 1`);
        return;
      }
      if (p.scannedRows.length !== qty) {
        toast.error(
          `${p.productName}: quantity is ${qty} but scanned rows are ${p.scannedRows.length}. Scan all units first.`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoice_number: invoiceNumber,
        customer_name: customerName,
        date_logged: dateLogged || null,
        invoice_date: invoiceDate || null,
        customer_address: customerAddress || null,
        warranty_term: warrantyTerm || null,
        products: JSON.stringify(products),
      };
      const { error } = searchId
        ? await supabase
            .from("udi_registrations" as any)
            .update(payload)
            .eq("id", searchId)
        : await supabase.from("udi_registrations" as any).insert(payload);
      if (error) throw error;
      if (searchId) {
        // Edit mode — update existing record
        const { error } = await supabase
          .from("udi_registrations" as any)
          .update(payload)
          .eq("id", searchId);
        if (error) throw error;
      } else {
        // Create mode — insert new record
        const { error } = await supabase.from("udi_registrations" as any).insert(payload);
        if (error) throw error;
      }

      // ── Update traceability localStorage: "In stock" → "Out Stock" ──
      for (const p of products) {
        for (const r of p.scannedRows) {
          const m = r.udi.match(/\(10\)(.+?)\(21\)/);
          if (!m) continue;
          const lotNumber = m[1];
          const serialIndex = parseInt(r.serialNumber, 10) - 1;
          const statusKey = `trace-status-${lotNumber}`;
          try {
            const raw = localStorage.getItem(statusKey);
            if (raw) {
              const statuses = JSON.parse(raw) as Record<number, string>;
              if (statuses[serialIndex] === "In stock") {
                statuses[serialIndex] = "Out Stock";
                localStorage.setItem(statusKey, JSON.stringify(statuses));
              }
            }
          } catch {
            /* empty */
          }
        }
      }

      toast.success("UDI registration saved");
      if (searchId) {
        navigate({ to: "/udi-registration" });
      } else {
        resetForm();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setCustomerName("");
    setDateLogged("");
    setInvoiceDate("");
    setCustomerAddress("");
    setWarrantyTerm("");
    setProducts([]);
  };

  // ── Delete confirmation ──
  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "product") {
      setProducts(products.filter((_, i) => i !== deleteTarget.pi));
    } else {
      const updated = [...products];
      updated[deleteTarget.pi].scannedRows = updated[deleteTarget.pi].scannedRows.filter(
        (_, j) => j !== deleteTarget.ri,
      );
      setProducts(updated);
    }
    setDeleteTarget(null);
    setDeleteConfirmOpen(false);
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/udi-registration">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader
          title={searchId ? "Edit UDI Registration" : "Register UDIs"}
          subtitle={
            searchId
              ? "Update existing UDI registration"
              : "Create UDI registrations for production batches"
          }
        />
      </div>

      {/* Invoice Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Invoice Details</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generateCsv}>
                <Download className="h-4 w-4 mr-1" /> Generate CSV
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="label-caps">Invoice Number</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-XXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Date Logged</Label>
              <Input
                type="date"
                value={dateLogged}
                onChange={(e) => setDateLogged(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Invoice Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Customer Address</Label>
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Customer address"
                rows={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Select Warranty Term</Label>
              <Select value={warrantyTerm} onValueChange={setWarrantyTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warranty term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_year">1 Year</SelectItem>
                  <SelectItem value="2_year">2 Years</SelectItem>
                  <SelectItem value="3_year">3 Years</SelectItem>
                  <SelectItem value="5_year">5 Years</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Product Details</h2>
            <Button variant="outline" onClick={addProductRow}>
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground py-6 text-sm"
                    >
                      No products added. Click "Add Product" to begin.
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[13px] text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        {row.isNew ? (
                          <Select value={row.productId} onValueChange={(v) => selectProduct(i, v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select product name" />
                            </SelectTrigger>
                            <SelectContent>
                              {productOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.product_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm">{row.productName}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.isNew ? (
                          <Input
                            type="number"
                            value={row.quantity}
                            onChange={(e) => updateProduct(i, "quantity", e.target.value)}
                            placeholder="Enter quantity"
                            className="h-9"
                            min={1}
                          />
                        ) : (
                          <span className="text-sm">{row.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.isNew && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setDeleteTarget({ kind: "product", pi: i });
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Product Summary Table */}
          {products.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4 mt-6">
                <h3 className="text-lg font-semibold">Product Summary</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const idx = products.findIndex(
                      (p) =>
                        p.isNew &&
                        p.productId &&
                        p.scannedRows.length < (parseInt(p.quantity, 10) || 0),
                    );
                    if (idx >= 0) openScan(idx);
                    else toast.info("All products fully scanned");
                  }}
                >
                  <ScanLine className="h-4 w-4 mr-1" /> Scan
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Date of Batch Creation</TableHead>
                      <TableHead>GTIN</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>UDI</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) =>
                      p.scannedRows.map((r, ri) => (
                        <TableRow key={`${p.productId}-${ri}`}>
                          <TableCell className="text-[13px] py-2.5 font-medium">
                            {p.productName}
                          </TableCell>
                          <TableCell className="text-[13px] py-2.5">
                            {r.dateOfBatchCreation}
                          </TableCell>
                          <TableCell className="text-[13px] py-2.5 font-mono">{r.gtin}</TableCell>
                          <TableCell className="text-[13px] py-2.5 font-mono">
                            {r.serialNumber}
                          </TableCell>
                          <TableCell className="text-[13px] py-2.5 font-mono">
                            {r.lotNumber}
                          </TableCell>
                          <TableCell className="text-[12px] py-2.5 font-mono text-muted-foreground max-w-[300px] break-all">
                            {r.udi}
                          </TableCell>
                          <TableCell className="py-2.5">
                            {p.isNew && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  const pi = products.indexOf(p);
                                  setDeleteTarget({ kind: "scan", pi, ri });
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={generateCsv}>
          <Download className="h-4 w-4 mr-1" /> Generate CSV
        </Button>
        <Button onClick={handleSave} disabled={saving} className="px-8">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Scan UDI Dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan UDI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {scanProductIndex >= 0 && products[scanProductIndex] && (
              <div className="text-sm text-muted-foreground">
                Product:{" "}
                <span className="font-medium text-foreground">
                  {products[scanProductIndex].productName}
                </span>
                {products[scanProductIndex].gtin && (
                  <>
                    {" "}
                    · GTIN: <span className="font-mono">{products[scanProductIndex].gtin}</span>
                  </>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="label-caps">UDI</Label>
              <Input
                value={scanUdiInput}
                onChange={(e) => {
                  setScanUdiInput(e.target.value);
                  setScanError("");
                }}
                placeholder="GTIN(11)Date(10)Batch(21)Batch-Serial"
                className="font-mono"
                onKeyDown={(e) => e.key === "Enter" && parseUdi()}
                autoFocus
              />
              {scanError && <p className="text-sm text-destructive mt-1">{scanError}</p>}
            </div>
            {scanProductIndex >= 0 && products[scanProductIndex] && (
              <div className="text-xs text-muted-foreground">
                Scanned: {products[scanProductIndex].scannedRows.length} /{" "}
                {products[scanProductIndex].quantity || 0}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setScanOpen(false);
                setScanError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={parseUdi}>Scan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Delete
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "product"
                ? "Are you sure you want to remove this product and all its scanned rows?"
                : "Are you sure you want to remove this scanned UDI entry?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteTarget(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
