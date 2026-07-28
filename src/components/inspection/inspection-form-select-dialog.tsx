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
}

interface FormTemplate {
  id: string;
  part_name: string;
  record_id: string;
}

export function InspectionFormSelectDialog({ open, onOpenChange, productId, batchId }: Props) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
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
        setLoading(false);
        return;
      }

      const { data: tmpls } = await supabase
        .from("inspection_form_templates")
        .select("id, part_name, record_id")
        .in("id", pifs.map((p: any) => p.template_id));

      setTemplates((tmpls ?? []) as FormTemplate[]);
      setLoading(false);
    })();
  }, [open, productId]);

  const openForm = (templateId: string) => {
    const searchParams: Record<string, string> = { templateId };
    if (batchId) {
      searchParams.batchId = batchId;
    }
    navigate({
      to: "/product-inspection/$productId",
      params: { productId },
      search: searchParams,
    });
    onOpenChange(false);
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
                className="w-full text-left px-4 py-3 rounded-lg border border-border bg-white hover:bg-[#F8FAFC] hover:border-[#1E3A8A] transition-all cursor-pointer"
              >
                <div className="text-sm font-medium text-[#0F172A]">{t.part_name}</div>
                <div className="text-xs text-[#64748B]">{t.record_id}</div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}