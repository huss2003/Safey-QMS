import { useState, useRef } from "react";
import { Upload, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type ColumnMap = Record<string, string>;
type ImportAction = "vendors" | "raw_materials";

const TEMPLATES: Record<ImportAction, { headers: string[]; sample: Record<string, string>[] }> = {
  vendors: {
    headers: ["name", "phone", "address", "materials_supplied", "notes"],
    sample: [
      {
        name: "Example Supplier",
        phone: "9876543210",
        address: "Mumbai",
        materials_supplied: "PC,POM",
        notes: "",
      },
    ],
  },
  raw_materials: {
    headers: [
      "material_type",
      "vendor_name",
      "initial_quantity_kg",
      "rate_per_kg",
      "purchase_date",
      "notes",
    ],
    sample: [
      {
        material_type: "PC",
        vendor_name: "Example Supplier",
        initial_quantity_kg: "500",
        rate_per_kg: "120",
        purchase_date: "2026-07-24",
        notes: "",
      },
    ],
  },
};

export function CsvImportModal({
  action,
  onSuccess,
}: {
  action: ImportAction;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const template = TEMPLATES[action];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) {
        toast.error("CSV must have headers + at least 1 row");
        setParsing(false);
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim());
      const rows = lines.slice(1, 6).map((line) => {
        const vals = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = vals[i] ?? "";
        });
        return row;
      });
      setPreview(rows);
      setParsing(false);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!fileRef.current?.files?.[0]) return;
    setImporting(true);
    try {
      const text = await fileRef.current.files[0].text();
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map((h) => h.trim());
      const dataRows = lines.slice(1).filter((l) => l.trim());

      let success = 0;
      for (const line of dataRows) {
        const vals = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = vals[i] ?? "";
        });

        if (action === "vendors") {
          const { error } = await supabase.from("vendors").insert({
            name: row.name,
            phone: row.phone,
            address: row.address ?? "",
            materials_supplied: (row.materials_supplied ?? "").split(",").filter(Boolean),
            notes: row.notes || null,
          });
          if (!error) success++;
        } else if (action === "raw_materials") {
          const { data: vendor } = await supabase
            .from("vendors")
            .select("id")
            .ilike("name", row.vendor_name)
            .limit(1)
            .single()
            .maybe();
          if (!vendor) continue;
          const { error } = await supabase.from("raw_materials").insert({
            material_type: row.material_type as any,
            vendor_id: vendor.id,
            initial_quantity_kg: parseFloat(row.initial_quantity_kg),
            rate_per_kg: parseFloat(row.rate_per_kg),
            purchase_date: row.purchase_date || undefined,
            notes: row.notes || null,
          });
          if (!error) success++;
        }
      }

      toast.success(`Imported ${success} of ${dataRows.length} ${action}`);
      qc.invalidateQueries({ queryKey: [action] });
      setOpen(false);
      setPreview(null);
      onSuccess?.();
    } catch (err) {
      toast.error("Import failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = [
      template.headers.join(","),
      ...template.sample.map((r) => template.headers.map((h) => r[h] ?? "").join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${action}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const label = action === "vendors" ? "vendors" : "raw materials";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" /> Import {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import {label}</DialogTitle>
          <DialogDescription>Upload a CSV file with {label} data.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={downloadTemplate}>
            <FileDown className="h-4 w-4 mr-2" /> Download template
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />

          {parsing && <p className="text-sm text-muted-foreground">Parsing…</p>}

          {preview && (
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {template.headers.map((h) => (
                      <th key={h} className="px-2 py-1 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t">
                      {template.headers.map((h) => (
                        <td key={h} className="px-2 py-1">
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 py-1 text-[10px] text-muted-foreground border-t">
                Showing first {preview.length} rows
              </p>
            </div>
          )}

          {preview && (
            <Button onClick={doImport} disabled={importing} className="w-full">
              {importing ? "Importing…" : `Import ${label}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
