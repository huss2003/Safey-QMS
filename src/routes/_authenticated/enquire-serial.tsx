import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/enquire-serial")({
  component: EnquireSerialPage,
});

type EnquiryResult = {
  invoice_number: string;
  serial_number: string;
  invoice_date: string | null;
  customer_name: string;
  product_name: string;
  warranty_term: string;
  udi: string;
};

function EnquireSerialPage() {
  const [serialInput, setSerialInput] = useState("");
  const [result, setResult] = useState<EnquiryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleFetch = async () => {
    const raw = serialInput.trim();
    if (!raw) {
      toast.error("Enter a serial number");
      return;
    }

    setLoading(true);
    setSearched(true);
    setResult(null);

    try {
      // Input can be: "B008-0001" (lot-serial) or full UDI "99999(11)...(21)B008-0001"
      // Normalize: extract lot number and serial to build the search key
      let searchLot = "";
      let searchSerial = "";

      if (raw.includes("(21)")) {
        // Full UDI provided — extract from (21) onwards
        const m = raw.match(/\(21\)(.+)$/);
        if (m) {
          const lotSerial = m[1]; // e.g. "B008-0001"
          const dashIdx = lotSerial.lastIndexOf("-");
          searchLot = lotSerial.substring(0, dashIdx);
          searchSerial = lotSerial.substring(dashIdx + 1);
        }
      } else if (raw.includes("-")) {
        // Lot-Serial format: B008-0001
        const dashIdx = raw.lastIndexOf("-");
        searchLot = raw.substring(0, dashIdx);
        searchSerial = raw.substring(dashIdx + 1);
      } else {
        toast.error("Invalid format. Use: B008-0001 or full UDI");
        setLoading(false);
        return;
      }

      if (!searchLot || !searchSerial) {
        toast.error("Could not parse serial number");
        setLoading(false);
        return;
      }

      // Search all udi_registrations for matching UDI
      const { data: registrations, error } = await supabase
        .from("udi_registrations" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Pattern to match: anything ending with (21)Lot-Serial
      const udiPattern = new RegExp(
        `\\(21\\)${searchLot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-${searchSerial}$`,
      );

      let found: EnquiryResult | null = null;

      for (const reg of registrations ?? []) {
        try {
          const prods = JSON.parse(reg.products ?? "[]");
          for (const p of prods) {
            for (const r of p.scannedRows ?? []) {
              if (udiPattern.test(r.udi)) {
                found = {
                  invoice_number: reg.invoice_number,
                  serial_number: `${searchLot}-${searchSerial}`,
                  invoice_date: reg.invoice_date,
                  customer_name: reg.customer_name,
                  product_name: p.productName,
                  warranty_term: reg.warranty_term,
                  udi: r.udi,
                };
                break;
              }
            }
            if (found) break;
          }
        } catch {
          /* empty */
        }
        if (found) break;
      }

      setResult(found);
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  };

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

  const isWarrantyActive = (warrantyTerm: string) => {
    // Simplified: active if term is set
    return !!warrantyTerm;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/udi-registration">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Enquire Serial Number</h1>
          <p className="text-sm text-muted-foreground">
            Enter a serial number (e.g. B008-0001) or full UDI to fetch product details
          </p>
        </div>
      </div>

      {/* Search Input */}
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="space-y-1.5">
              <Label className="label-caps">Enter Serial Number</Label>
              <div className="relative">
                <Input
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="e.g. B008-0001"
                  className="pr-8"
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                />
                {serialInput && (
                  <button
                    onClick={() => {
                      setSerialInput("");
                      setResult(null);
                      setSearched(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <Button
              onClick={handleFetch}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? "Fetching..." : "Fetch Details"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Product UDI Details</h2>
            {result ? (
              <div className="border rounded-md">
                <table className="w-full">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-6 font-semibold text-sm w-48">Invoice Number</td>
                      <td className="py-3 px-6 text-sm">{result.invoice_number}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-6 font-semibold text-sm">Serial Number</td>
                      <td className="py-3 px-6 text-sm font-mono">{result.serial_number}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-6 font-semibold text-sm">Invoice Date</td>
                      <td className="py-3 px-6 text-sm">
                        {result.invoice_date
                          ? new Date(result.invoice_date).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-6 font-semibold text-sm">Customer Name</td>
                      <td className="py-3 px-6 text-sm">{result.customer_name}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-6 font-semibold text-sm">Product Name</td>
                      <td className="py-3 px-6 text-sm text-blue-600 font-medium">
                        {result.product_name}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-6 font-semibold text-sm">Warranty Status</td>
                      <td className="py-3 px-6">
                        <Badge
                          className={
                            isWarrantyActive(result.warranty_term)
                              ? "bg-emerald-500 text-white hover:bg-emerald-500"
                              : "bg-red-500 text-white hover:bg-red-500"
                          }
                        >
                          {isWarrantyActive(result.warranty_term) ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No product found with serial number "{serialInput}". Check the serial and try again.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
