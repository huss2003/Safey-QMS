import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  batchId?: string;
  batchNumber?: string;
}

interface FormTemplate {
  id: string;
  part_name: string;
  record_id: string;
}

interface ExistingInspection {
  template_id: string;
  overall_result: string | null;
  inspection_id: string;
}

export function InspectionFormSelectDialog({
  open,
  onOpenChange,
  productId,
  batchId,
  batchNumber,
}: Props) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [existingMap, setExistingMap] = useState<Map<string, ExistingInspection>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      // Fetch inspection form templates selected for this product
      const { data: pifs } = await supabase
        .from("product_inspection_forms")
        .select("template_id")
        .eq("product_id", productId);

      if (!pifs || pifs.length === 0) {
        setTemplates([]);
        setLoading(false);
        return;
      }

      const { data: tmpls } = await supabase
        .from("inspection_form_templates")
        .select("id, part_name, record_id")
        .in(
          "id",
          pifs.map((p: any) => p.template_id),
        );

      setTemplates((tmpls ?? []) as FormTemplate[]);

      // Fetch existing inspections for this batch
      if (batchNumber) {
        const { data: existing } = await supabase
          .from("product_inspections" as any)
          .select("id, template_id, overall_result")
          .eq("batch_number", batchNumber);

        const map = new Map<string, ExistingInspection>();
        for (const insp of (existing ?? []) as any[]) {
          if (insp.template_id) {
            map.set(insp.template_id, {
              template_id: insp.template_id,
              overall_result: insp.overall_result,
              inspection_id: insp.id,
            });
          }
        }
        setExistingMap(map);
      } else {
        setExistingMap(new Map());
      }

      setLoading(false);
    })();
  }, [open, productId, batchNumber]);

  const openForm = (templateId: string) => {
    const existing = existingMap.get(templateId);
    const searchParams: Record<string, string> = { templateId };
    if (batchId) searchParams.batchId = batchId;
    // If already inspected, open in view mode
    if (existing) {
      searchParams.inspectionId = existing.inspection_id;
    }
    navigate({
      to: "/product-inspection/$productId",
      params: { productId },
      search: searchParams as any,
    });
    onOpenChange(false);
  };

  const getStatusStyle = (templateId: string) => {
    const existing = existingMap.get(templateId);
    if (!existing) return ""; // No result yet — default
    if (existing.overall_result === "Pass") {
      return "bg-green-50 border-green-400 hover:bg-green-100";
    }
    if (existing.overall_result === "Fail") {
      return "bg-red-50 border-red-400 hover:bg-red-100";
    }
    return "";
  };

  const getStatusBadge = (templateId: string) => {
    const existing = existingMap.get(templateId);
    if (!existing) return null;
    if (existing.overall_result === "Pass") {
      return (
        <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
          Passed
        </span>
      );
    }
    if (existing.overall_result === "Fail") {
      return (
        <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
          Failed
        </span>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Inspection Form
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No inspection forms selected for this product.
            </p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => openForm(t.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${getStatusStyle(t.id) || "border-border bg-white hover:bg-[#F8FAFC] hover:border-[#1E3A8A]"}`}
              >
                <div>
                  <div className="text-sm font-medium text-[#0F172A]">{t.part_name}</div>
                  <div className="text-xs text-[#64748B]">{t.record_id}</div>
                </div>
                {getStatusBadge(t.id)}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
