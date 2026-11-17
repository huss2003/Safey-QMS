import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ArrowLeft, Upload, FileText, CheckCircle2, ScanLine } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/new-shipment")({
  validateSearch: (search: Record<string, unknown>): { draft?: string; step?: string } => ({
    draft: typeof search.draft === "string" ? search.draft : undefined,
    step: typeof search.step === "string" ? search.step : undefined,
  }),
  component: NewShipmentPage,
});

const STAGE_CREATED = 0;
const BUCKET = "invoices";

type AddressRow = { id: string; customer_name: string; address_type: "bill" | "ship"; address: string; is_default: boolean };

type DraftRow = {
  id: string;
  invoice_number: string | null;
  customer_name: string;
  customer_address: string | null;
  ship_to_address: string | null;
  invoice_pdf_path: string | null;
  invoice_pdf_name: string | null;
  created_at: string | null;
};

// ── Page ───────────────────────────────────────────────────────────

function NewShipmentPage() {
  const { draft, step } = Route.useSearch();

  if (draft && step === "upload") return <UploadInvoiceStep draftId={draft} />;
  if (draft) return <ReopenDraft draftId={draft} />;
  return <StartShipment />;
}

// ── Start: customer search + drafts list ───────────────────────────

function StartShipment() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<string | null>(null);

  if (customer) {
    return (
      <AddressStep
        customerName={customer}
        onBack={() => setCustomer(null)}
        onDraftSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["shipment-drafts"] });
          toast.success("Draft saved");
          setCustomer(null);
        }}
      />
    );
  }

  const { data: matches = [] } = useQuery({
    queryKey: ["customer-search", query],
    queryFn: async (): Promise<AddressRow[]> => {
      const q = query.trim();
      let req = (supabase.from("customer_addresses" as any) as any)
        .select("id, customer_name, address_type, address, is_default")
        .eq("address_type", "bill")
        .order("customer_name")
        .limit(30);
      if (q) req = req.ilike("customer_name", `%${q}%`);
      const { data, error } = await req;
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const { data: drafts = [] } = useQuery({
    queryKey: ["shipment-drafts"],
    queryFn: async (): Promise<DraftRow[]> => {
      const { data, error } = await (supabase.from("udi_registrations" as any) as any)
        .select("id, invoice_number, customer_name, customer_address, ship_to_address, invoice_pdf_path, invoice_pdf_name, created_at")
        .eq("is_draft", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DraftRow[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/delivery">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader subtitle="Delivery" title="Create New Shipment" />
      </div>

      <Card>
        <CardContent className="p-6 space-y-3">
          <Label htmlFor="cust-search">Search customer</Label>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="cust-search"
              className="pl-9"
              placeholder="Type a customer name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="divide-y rounded-md border max-w-xl">
            {matches.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">No customers found.</p>
            )}
            {matches.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomer(c.customer_name)}
                className="w-full text-left p-3 hover:bg-muted"
              >
                <div className="font-medium">{c.customer_name}</div>
                <div className="text-xs text-muted-foreground truncate">{c.address}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-medium">Saved drafts</h3>
            <div className="divide-y rounded-md border">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-medium">{d.customer_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.invoice_number ? `Invoice ${d.invoice_number}` : "No invoice number yet"}
                      {d.created_at ? ` · ${new Date(d.created_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/new-shipment", search: { draft: d.id } })}
                  >
                    Open
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Step 2: bill-to and ship-to ────────────────────────────────────

function AddressStep({
  customerName,
  onBack,
  onDraftSaved,
}: {
  customerName: string;
  onBack: () => void;
  onDraftSaved: () => void;
}) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [shipChoice, setShipChoice] = useState<string | null>(null);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["customer-addresses", customerName],
    queryFn: async (): Promise<AddressRow[]> => {
      const { data, error } = await (supabase.from("customer_addresses" as any) as any)
        .select("id, customer_name, address_type, address, is_default")
        .ilike("customer_name", customerName);
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const bill = addresses.find((a) => a.address_type === "bill") ?? null;
  const ships = addresses.filter((a) => a.address_type === "ship");

  // One ship-to saved: select it automatically. Several: user picks. None: Bill To is used.
  useEffect(() => {
    if (ships.length === 1 && shipChoice === null) setShipChoice(ships[0].id);
  }, [ships.length]);

  const chosenShip = ships.find((s) => s.id === shipChoice) ?? null;
  const shipToText = chosenShip?.address ?? bill?.address ?? "";

  const createDraft = async () => {
    const { data, error } = await (supabase.from("udi_registrations" as any) as any)
      .insert({
        invoice_number: null,
        customer_name: customerName,
        customer_address: bill?.address ?? null,
        ship_to_address: shipToText || null,
        date_logged: new Date().toISOString().slice(0, 10),
        products: [],
        stage: STAGE_CREATED,
        stage_updated_at: new Date().toISOString(),
        is_draft: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const continueToScan = async () => {
    if (!bill) return toast.error("This customer has no bill-to address");
    setSaving(true);
    try {
      const id = await createDraft();
      navigate({ to: "/register-udi", search: { draft: id } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create shipment");
    } finally {
      setSaving(false);
    }
  };

  const saveDraftAndExit = async () => {
    if (!bill) return toast.error("This customer has no bill-to address");
    setSaving(true);
    try {
      await createDraft();
      onDraftSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Could not save draft");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader subtitle="Delivery" title="Create New Shipment" />
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Customer:</span>
            <Badge variant="secondary">{customerName}</Badge>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading addresses…</p>
          ) : !bill ? (
            <p className="text-sm text-destructive">No bill-to address is saved for this customer.</p>
          ) : (
            <>
              <section className="space-y-2">
                <Label>Bill To</Label>
                <div className="rounded-md border border-primary p-3 text-sm whitespace-pre-line">
                  {bill.address}
                </div>
              </section>

              <section className="space-y-2">
                <Label>Ship To</Label>
                {ships.length === 0 && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No ship-to saved. Bill To will be used.
                  </div>
                )}
                {ships.length > 0 && (
                  <div className="grid gap-2 md:grid-cols-2">
                    {ships.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setShipChoice(s.id)}
                        className={cn(
                          "text-left rounded-md border p-3 text-sm whitespace-pre-line",
                          shipChoice === s.id ? "border-primary bg-primary/5" : "hover:bg-muted",
                        )}
                      >
                        {s.address}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={saveDraftAndExit} disabled={saving}>
                  Save as draft
                </Button>
                <Button onClick={continueToScan} disabled={saving}>
                  <ScanLine className="h-4 w-4 mr-1" /> Continue to Scan UDI
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Reopen a draft: go to the step it stopped at ───────────────────

function ReopenDraft({ draftId }: { draftId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["shipment-draft", draftId],
    queryFn: async (): Promise<DraftRow> => {
      const { data, error } = await (supabase.from("udi_registrations" as any) as any)
        .select("id, invoice_number, customer_name, customer_address, ship_to_address, invoice_pdf_path, invoice_pdf_name, created_at")
        .eq("id", draftId)
        .single();
      if (error) throw error;
      return data as DraftRow;
    },
  });

  useEffect(() => {
    if (!data) return;
    if (data.invoice_number) {
      navigate({ to: "/new-shipment", search: { draft: draftId, step: "upload" }, replace: true });
    } else {
      navigate({ to: "/register-udi", search: { draft: draftId }, replace: true });
    }
  }, [data]);

  return <p className="p-6 text-sm text-muted-foreground">Opening draft…</p>;
}

// ── Step 4: invoice upload (after Scan UDI save) ───────────────────

function UploadInvoiceStep({ draftId }: { draftId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipment-draft", draftId],
    queryFn: async (): Promise<DraftRow> => {
      const { data, error } = await (supabase.from("udi_registrations" as any) as any)
        .select("id, invoice_number, customer_name, customer_address, ship_to_address, invoice_pdf_path, invoice_pdf_name, created_at")
        .eq("id", draftId)
        .single();
      if (error) throw error;
      return data as DraftRow;
    },
  });

  const onFile = async (file: File) => {
    const ok = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!ok) return toast.error("Upload a PDF or an image");
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${draftId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await (supabase.from("udi_registrations" as any) as any)
        .update({ invoice_pdf_path: path, invoice_pdf_name: file.name })
        .eq("id", draftId);
      if (dbErr) throw dbErr;
      toast.success("Invoice uploaded");
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const complete = async () => {
    setCompleting(true);
    try {
      const { error } = await (supabase.from("udi_registrations" as any) as any)
        .update({ is_draft: false, stage: STAGE_CREATED, stage_updated_at: new Date().toISOString() })
        .eq("id", draftId);
      if (error) throw error;
      toast.success(`Invoice ${data?.invoice_number ?? ""} created`);
      queryClient.invalidateQueries({ queryKey: ["delivery-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["shipment-drafts"] });
      navigate({ to: "/delivery" });
    } catch (e: any) {
      toast.error(e.message ?? "Could not complete");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ to: "/new-shipment" })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader subtitle="Delivery" title="Upload Invoice" />
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {isLoading || !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Invoice: </span>
                  <span className="font-mono">{data.invoice_number ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer: </span>
                  {data.customer_name}
                </div>
              </div>

              <div className="rounded-md border border-dashed p-6 text-center space-y-3">
                {data.invoice_pdf_path ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <FileText className="h-4 w-4" />
                    {data.invoice_pdf_name}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Upload the invoice (PDF or image). Required.</p>
                )}
                <Label htmlFor="invoice-file" className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Uploading…" : data.invoice_pdf_path ? "Replace file" : "Choose file"}
                </Label>
                <input
                  id="invoice-file"
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={complete} disabled={!data.invoice_pdf_path || completing}>
                  {completing ? "Creating…" : "Create invoice"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
