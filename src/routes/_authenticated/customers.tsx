import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Plus, Trash2, Save, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type AddressRow = {
  id: string;
  customer_name: string;
  address_type: "bill" | "ship";
  address: string;
  created_at: string | null;
};

const table = () => supabase.from("customer_addresses" as any) as any;

function CustomersPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBill, setNewBill] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["customers-page"],
    queryFn: async (): Promise<AddressRow[]> => {
      const { data, error } = await table()
        .select("id, customer_name, address_type, address, created_at")
        .order("customer_name");
      if (error) throw error;
      return (data ?? []) as AddressRow[];
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["customers-page"] });
    queryClient.invalidateQueries({ queryKey: ["customer-search"] });
    queryClient.invalidateQueries({ queryKey: ["customer-addresses"] });
  };

  // One entry per customer name, built from the bill-to rows
  const customers = useMemo(
    () => rows.filter((r) => r.address_type === "bill"),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? customers.filter((c) => c.customer_name.toLowerCase().includes(q)) : customers;
  }, [customers, query]);

  const bill = customers.find((c) => c.customer_name === selected) ?? null;
  const ships = rows.filter((r) => r.address_type === "ship" && r.customer_name === selected);

  const addCustomer = async () => {
    const name = newName.trim();
    const address = newBill.trim();
    if (!name || !address) return toast.error("Customer name and Bill To address are required");
    setSaving(true);
    try {
      const { error } = await table().insert({
        customer_name: name,
        address_type: "bill",
        address,
      });
      if (error) {
        if (error.code === "23505") return toast.error(`Customer "${name}" already exists`);
        throw error;
      }
      toast.success("Customer added");
      setAdding(false);
      setNewName("");
      setNewBill("");
      setSelected(name);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not add customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader subtitle="Delivery" title="Customers & Addresses" />
        <Button onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> New customer
        </Button>
      </div>

      {adding && (
        <Card>
          <CardContent className="p-6 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-name">Customer name *</Label>
              <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-bill">Bill To address *</Label>
              <Textarea
                id="new-bill"
                rows={3}
                value={newBill}
                onChange={(e) => setNewBill(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button onClick={addCustomer} disabled={saving}>
                {saving ? "Saving…" : "Add customer"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Customer list */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search customers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="divide-y rounded-md border max-h-[60vh] overflow-auto">
              {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading…</p>}
              {!isLoading && filtered.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No customers found.</p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.customer_name)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted",
                    selected === c.customer_name && "bg-muted",
                  )}
                >
                  <div className="font-medium">{c.customer_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.address}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detail */}
        <div className="space-y-6">
          {!bill && (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Select a customer to see and edit their addresses.
              </CardContent>
            </Card>
          )}

          {bill && (
            <>
              <BillToCard
                key={`bill-${bill.id}`}
                row={bill}
                onSaved={refresh}
              />
              <ShipToCard
                key={`ship-${bill.customer_name}`}
                customerName={bill.customer_name}
                ships={ships}
                onChanged={refresh}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BillToCard({ row, onSaved }: { row: AddressRow; onSaved: () => void }) {
  const [address, setAddress] = useState(row.address);
  const [saving, setSaving] = useState(false);
  const dirty = address.trim() !== row.address;

  const save = async () => {
    if (!address.trim()) return toast.error("Bill To cannot be empty");
    setSaving(true);
    try {
      const { error } = await table().update({ address: address.trim() }).eq("id", row.id);
      if (error) throw error;
      toast.success("Bill To saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{row.customer_name}</h3>
          <span className="text-xs text-muted-foreground">Bill To (one per customer)</span>
        </div>
        <Textarea rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving} size="sm">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Bill To"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShipToCard({
  customerName,
  ships,
  onChanged,
}: {
  customerName: string;
  ships: AddressRow[];
  onChanged: () => void;
}) {
  const [newShip, setNewShip] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!newShip.trim()) return;
    setSaving(true);
    try {
      const { error } = await table().insert({
        customer_name: customerName,
        address_type: "ship",
        address: newShip.trim(),
      });
      if (error) throw error;
      setNewShip("");
      toast.success("Ship To added");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not add");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
      toast.success("Ship To removed");
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove");
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Ship To addresses</h3>
          <span className="text-xs text-muted-foreground">
            ({ships.length} saved; Bill To is used if none)
          </span>
        </div>

        {ships.length === 0 && (
          <p className="text-sm text-muted-foreground">No ship-to addresses saved.</p>
        )}
        <div className="divide-y rounded-md border">
          {ships.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-3 p-3">
              <p className="text-sm whitespace-pre-line">{s.address}</p>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-ship">Add a ship-to address</Label>
          <Textarea
            id="new-ship"
            rows={3}
            value={newShip}
            onChange={(e) => setNewShip(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={add} disabled={!newShip.trim() || saving}>
              <Plus className="h-4 w-4 mr-1" /> Add Ship To
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
