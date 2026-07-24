import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Factory, CalendarClock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ProductionBatch } from "@/integrations/supabase/database.types";
import { PageHeader } from "@/components/inventory/page-header";
import { EmptyState } from "@/components/inventory/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDate, fmtNum, fmtKg } from "@/lib/inventory/format";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionPage,
});

type ProductionBatchJoined = ProductionBatch & {
  products?: { product_name: string } | null;
};

function ProductionPage() {
  const [cursor, setCursor] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["production_batches", cursor],
    queryFn: async () => {
      let q = supabase
        .from("production_batches")
        .select("*, products(product_name)")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) {
        q = q.lt("created_at", cursor);
      }
      const { data: rows, error } = await q;
      if (error) throw error;
      return rows as unknown as ProductionBatchJoined[];
    },
    staleTime: 30_000,
  });

  const hasMore = data && data.length > PAGE_SIZE;
  const displayData = data ? (hasMore ? data.slice(0, PAGE_SIZE) : data) : [];
  const lastItem = displayData.length > 0 ? displayData[displayData.length - 1] : null;

  return (
    <div>
      <PageHeader
        title="Production"
        subtitle="Record finished product manufacturing"
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/production-planning">
                <CalendarClock className="h-4 w-4" /> Plan Production
              </Link>
            </Button>
            <Button asChild>
              <Link to="/production-new">
                <Plus className="h-4 w-4" /> Start Production
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-sm text-muted-foreground text-center">Loading…</div>
          ) : displayData.length === 0 ? (
            <EmptyState
              icon={Factory}
              title="No production runs yet"
              description="Start your first production batch."
              action={
                <Button asChild>
                  <Link to="/production-new">
                    <Plus className="h-4 w-4" /> Start Production
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expected kg</TableHead>
                    <TableHead>Actual kg</TableHead>
                    <TableHead>Wastage %</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.map((r) => {
                    const pct =
                      Number(r.expected_raw_material_kg) > 0
                        ? (Number(r.wastage_kg) / Number(r.expected_raw_material_kg)) * 100
                        : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <Link
                            to="/traceability"
                            search={{ q: r.batch_number }}
                            className="hover:text-primary transition-colors"
                          >
                            {r.batch_number}
                          </Link>
                        </TableCell>
                        <TableCell>{r.products?.product_name}</TableCell>
                        <TableCell>{fmtNum(r.quantity_produced)}</TableCell>
                        <TableCell>{fmtKg(r.expected_raw_material_kg)}</TableCell>
                        <TableCell>{fmtKg(r.actual_raw_material_kg)}</TableCell>
                        <TableCell className={pct > 10 ? "text-destructive font-medium" : ""}>
                          {pct.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fmtDate(r.production_date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              r.status === "recalled"
                                ? "destructive"
                                : r.status === "completed"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    onClick={() => setCursor(lastItem?.created_at ?? null)}
                    disabled={isFetching}
                  >
                    {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
