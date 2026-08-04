import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Eye, Plus, Hash } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/udi-registration")({
  component: UdiDashboard,
});

type UdiReg = {
  id: string;
  invoice_number: string;
  customer_name: string;
  date_logged: string | null;
  invoice_date: string | null;
  products: string | null;
  created_at: string;
};

function UdiDashboard() {
  const [search, setSearch] = useState("");

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["udi-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("udi_registrations" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UdiReg[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return registrations;
    const q = search.toLowerCase();
    return registrations.filter(
      (r) =>
        r.invoice_number?.toLowerCase().includes(q) || r.customer_name?.toLowerCase().includes(q),
    );
  }, [registrations, search]);

  const totalCount = registrations.length;
  const incompleteCount = registrations.filter((r) => {
    try {
      const prods = JSON.parse(r.products ?? "[]");
      return prods.some((p: any) => {
        const scanned = p.scannedRows?.length ?? 0;
        const qty = parseInt(p.quantity, 10) || 0;
        return scanned < qty;
      });
    } catch {
      return true;
    }
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled>
            <Search className="h-4 w-4 mr-1" /> Enquire Serial Number
          </Button>
          <Link to="/register-udi">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Register UDIs
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground mb-1">Total UDI Register</div>
            <div className="text-3xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-sm text-muted-foreground mb-1">Incomplete UDI Registers</div>
            <div className="text-3xl font-bold text-destructive">{incompleteCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Registrations Table ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent UDI Registrations</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice Number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 w-64 text-[13px]"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No UDI registrations found.
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Logged</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const isIncomplete = (() => {
                      try {
                        const prods = JSON.parse(r.products ?? "[]");
                        return prods.some((p: any) => {
                          const scanned = p.scannedRows?.length ?? 0;
                          const qty = parseInt(p.quantity, 10) || 0;
                          return scanned < qty;
                        });
                      } catch {
                        return true;
                      }
                    })();

                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-[13px] py-2.5">
                          {r.date_logged
                            ? new Date(r.date_logged).toLocaleDateString("en-GB")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-[13px] py-2.5 font-medium">
                          {r.invoice_number}
                        </TableCell>
                        <TableCell className="text-[13px] py-2.5">{r.customer_name}</TableCell>
                        <TableCell className="text-[13px] py-2.5">
                          {r.invoice_date
                            ? new Date(r.invoice_date).toLocaleDateString("en-GB")
                            : "—"}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge
                            variant={isIncomplete ? "destructive" : "secondary"}
                            className={`text-[11px] ${
                              !isIncomplete ? "bg-teal-100 text-teal-700 border-teal-200" : ""
                            }`}
                          >
                            {isIncomplete ? "Incomplete" : "Complete"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
