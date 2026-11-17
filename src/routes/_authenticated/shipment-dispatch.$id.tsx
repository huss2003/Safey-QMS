import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Printer, Receipt, RotateCcw, FileText } from "lucide-react";

import { db as supabase } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShippingLabel } from "@/components/shipping-label";

export const Route = createFileRoute("/_authenticated/shipment-dispatch/$id")({
  component: DispatchPage,
});

type DispatchRow = {
  id: string;
  invoice_number: string | null;
  customer_name: string;
  customer_address: string | null;
  ship_to_address: string | null;
  delivery_service_provider: string | null;
  delivery_tracking_code: string | null;
};

function DispatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dispatch-detail", id],
    queryFn: async (): Promise<DispatchRow> => {
      const { data, error } = await (supabase.from("udi_registrations" as any) as any)
        .select("id, invoice_number, customer_name, customer_address, ship_to_address, delivery_service_provider, delivery_tracking_code")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as DispatchRow;
    },
  });

  if (isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Shipment not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/delivery" })}>Back to Delivery</Button>
      </div>
    );
  }
  if (isLoading || !data) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  // Keyed by record id; the form starts from the saved values on mount.
  return <DispatchForm key={data.id} row={data} />;
}

function DispatchForm({ row }: { row: DispatchRow }) {
  const id = row.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState(row.delivery_service_provider ?? "");
  const [tracking, setTracking] = useState(row.delivery_tracking_code ?? "");
  const [saving, setSaving] = useState(false);
  const saved = Boolean(row.delivery_tracking_code && row.delivery_service_provider);
  const [labelOpen, setLabelOpen] = useState(false);
  const shipTo = row.ship_to_address || row.customer_address;

  const submit = async () => {
    if (!provider.trim() || !tracking.trim()) {
      toast.error("Enter the delivery service provider and tracking code");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase.from("udi_registrations" as any) as any)
        .update({ delivery_service_provider: provider.trim(), delivery_tracking_code: tracking.trim() })
        .eq("id", id);
      if (error) throw error;
      toast.success("Tracking details saved");
      queryClient.invalidateQueries({ queryKey: ["dispatch-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["delivery-dashboard"] });
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setProvider("");
    setTracking("");
  };

  return (
  <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate({ to: "/shipment/$id", params: { id } })}
          aria-label="Back to shipment"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <CheckCircle2 className="h-9 w-9 text-green-700" />
          <div>
            <h1 className="text-xl font-semibold">Order Finalized Successfully</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge className="bg-orange-500 text-white hover:bg-orange-500">Ready for dispatch</Badge>
              <span>Invoice {row.invoice_number ?? "—"}</span>
              <span>· Order ID {row.id}</span>
            </div>
          </div>
        </div>
        <p className="text-right text-lg font-semibold uppercase tracking-wide">{row.customer_name}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Tracking code entry</h2>
        <Card>
          <CardContent className="grid gap-5 p-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Delivery service provider</Label>
              <Input id="provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Tirupati" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking code</Label>
              <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Enter tracking code" />
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={reset} disabled={saving}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
          <Button onClick={submit} disabled={saving}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Submit"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
          <Printer className="h-4 w-4 text-primary" /> Document printing
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DocCard
            icon={<FileText className="h-5 w-5" />}
            badge={saved ? "Generated" : "Pending tracking"}
            badgeOk={saved}
            title="Shipping Label"
            action={
              <Button className="w-full" onClick={() => setLabelOpen(true)}>
                <Printer className="mr-1 h-4 w-4" /> Print Label
              </Button>
            }
          />
          <DocCard
            icon={<FileText className="h-5 w-5" />}
            badge="Ready"
            badgeOk
            title="Delivery Challan"
            action={
              <Button className="w-full" onClick={() => window.print()}>
                <Printer className="mr-1 h-4 w-4" /> Print Delivery challan
              </Button>
            }
          />
          <DocCard
            icon={<Receipt className="h-5 w-5" />}
            badge="Awaiting NIC"
            badgeOk={false}
            title="E-Way Bill"
            action={
              <Button className="w-full" disabled>
                <RotateCcw className="mr-1 h-4 w-4" /> Upload E-Way
              </Button>
            }
          />
        </div>
      </section>

      <Dialog open={labelOpen} onOpenChange={setLabelOpen}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Shipping label</DialogTitle>
          </DialogHeader>
          <div className="print-label-area flex justify-center overflow-auto py-2">
            <ShippingLabel shipTo={shipTo} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelOpen(false)}>Close</Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate({ to: "/delivery" })}>Back to Delivery</Button>
      </div>
    </div>
  );
}

function DocCard({
  icon,
  badge,
  badgeOk,
  title,
  action,
}: {
  icon: React.ReactNode;
  badge: string;
  badgeOk: boolean;
  title: string;
  action: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between">
          <Badge className={badgeOk ? "bg-green-700 text-white hover:bg-green-700" : "bg-muted text-muted-foreground hover:bg-muted"}>
            {badge}
          </Badge>
          <span className="grid h-10 w-10 place-items-center rounded-md bg-muted text-muted-foreground">{icon}</span>
        </div>
        <p className="font-medium">{title}</p>
        {action}
      </CardContent>
    </Card>
  );
}
