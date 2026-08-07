import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Factory, CalendarClock, Loader2, ClipboardCheck } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtDate, fmtNum, fmtKg } from "@/lib/inventory/format";
import { InspectionFormSelectDialog } from "@/components/inspection/inspection-form-select-dialog";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/_authenticated/production")({
  component: ProductionPage,
});

type ProductionBatchJoined = ProductionBatch & {
  products?: { product_id: string; product_name: string } | null;
  inspection_results?: Array<{ overall_result: string | null; batch_id: string }> | null;
};

interface ProductInspection {
  id: string;
  product_id: string;
  batch_number: string;
  form_no: string;
  overall_result: string | null;
}

function ProductionPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [formDialog, setFormDialog] = useState<{
    productId: string;
    batchId?: string;
    batchNumber?: string;
    inspectionId?: string;
  } | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["production_batches", cursor],
    queryFn: async () => {
      let q = supabase
        .from("production_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (cursor) {
        q = q.lt("created_at", cursor);
      }
      const { data: rows, error } = await q;
      if (error) throw error;

      // Fetch products separately to avoid join issues
      const productIds = [...new Set(rows.map((r: any) => r.product_id).filter(Boolean))];
      const { data: products } =
        productIds.length > 0
          ? await supabase.from("products").select("id, product_name").in("id", productIds)
          : { data: [] };

      const productMap = new Map((products ?? []).map((p: any) => [p.id, p.product_name]));

      // Fetch part_batch_ids for these production batches
      const batchIds = rows.map((r: any) => r.id);
      const { data: partBatchLinks } = await supabase
        .from("production_batch_parts")
        .select("production_batch_id, part_batch_id")
        .in("production_batch_id", batchIds);

      // Fetch inspection results for part batches
      const partBatchIds = (partBatchLinks ?? []).map((l: any) => l.part_batch_id);
      const { data: inspectionData } = await supabase
        .from("inspection_records" as any)
        .select("batch_id, overall_result")
        .in("batch_id", partBatchIds);

      // Fetch product inspections for these production batches
      const batchNumbers = rows.map((r: any) => r.batch_number);
      const { data: productInspections } = await supabase
        .from("product_inspections" as any)
        .select("id, product_id, batch_number, form_no, overall_result")
        .in("batch_number", batchNumbers);

      // Attach inspection results and product name to each production batch
      const rowsWithInspection = rows.map((row: any) => {
        const rowPartBatchIds = (partBatchLinks ?? [])
          .filter((l: any) => l.production_batch_id === row.id)
          .map((l: any) => l.part_batch_id);
        const partBatchId = rowPartBatchIds[0] ?? null;
        const inspection =
          ((inspectionData as any) ?? []).filter((i: any) =>
            rowPartBatchIds.includes(i.batch_id),
          ) ?? [];
        const productInspectionsForBatch = ((productInspections as any) ?? []).filter(
          (pi: any) => pi.batch_number === row.batch_number,
        );
        const productInspection = productInspectionsForBatch[0] ?? null;

        // Determine inspection result — ANY fail => Failed, ALL pass => Passed
        let inspectionResult = "Not inspected";
        let overallResult = null;
        const allInspectionResults = [
          ...productInspectionsForBatch.map((pi: any) => pi.overall_result),
          ...inspection.map((i: any) => i.overall_result),
        ].filter(Boolean);
        if (allInspectionResults.length > 0) {
          if (allInspectionResults.includes("Failed") || allInspectionResults.includes("Fail")) {
            inspectionResult = "Failed";
            overallResult = "Failed";
          } else if (allInspectionResults.every((r) => r === "Pass" || r === "Passed")) {
            inspectionResult = "Passed";
            overallResult = "Passed";
          } else {
            inspectionResult = "Pending";
            overallResult = "Pending";
          }
        } else if (productInspection) {
          inspectionResult = productInspection.overall_result ?? "Pending";
          overallResult = productInspection.overall_result;
        }

        return {
          ...row,
          inspection_results: inspection,
          part_batch_id: partBatchId,
          part_batch_ids: rowPartBatchIds,
          products: {
            product_id: row.product_id,
            product_name: productMap.get(row.product_id) ?? "",
          },
          inspection_result: inspectionResult,
          overall_result: overallResult,
          product_inspection_id: productInspection?.id,
        };
      });

      return rowsWithInspection as unknown as (ProductionBatchJoined & {
        part_batch_id?: string;
        part_batch_ids?: string[];
        inspection_result?: string;
        overall_result?: string | null;
        product_inspection_id?: string;
      })[];
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
                    <TableHead>BATCH</TableHead>
                    <TableHead>PRODUCT</TableHead>
                    <TableHead>QUANTITY</TableHead>
                    <TableHead>EXPECTED KG</TableHead>
                    <TableHead>ACTUAL KG</TableHead>
                    <TableHead>WASTAGE %</TableHead>
                    <TableHead>DATE</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead>INSPECTION RESULT</TableHead>
                    <TableHead className="w-[80px]">ACTION</TableHead>
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
                        <TableCell>
                          <Badge
                            variant={
                              r.overall_result === "Failed" || r.overall_result === "Fail"
                                ? "destructive"
                                : r.overall_result === "Pass" || r.overall_result === "Passed"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {r.inspection_result}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    if (r.products?.product_id) {
                                      setFormDialog({
                                        productId: r.products.product_id,
                                        batchId: r.id,
                                        batchNumber: r.batch_number,
                                      });
                                    } else {
                                      navigate({
                                        to: "/inspection-form/$batchId" as any,
                                        params: { batchId: r.part_batch_id ?? r.id } as any,
                                      });
                                    }
                                  }}
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {r.product_inspection_id
                                    ? "View Inspection Form"
                                    : "Fill Inspection Form"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
      <InspectionFormSelectDialog
        open={!!formDialog}
        onOpenChange={(o) => {
          if (!o) setFormDialog(null);
        }}
        productId={formDialog?.productId ?? ""}
        batchId={formDialog?.batchId}
        batchNumber={formDialog?.batchNumber}
      />
    </div>
  );
}
