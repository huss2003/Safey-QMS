import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/udi-registration")({
  component: UdiRegistrationPage,
});

type ProductRow = {
  productName: string;
  quantity: string;
};

function UdiRegistrationPage() {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [dateLogged, setDateLogged] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [warrantyTerm, setWarrantyTerm] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([{ productName: "", quantity: "" }]);
  const [saving, setSaving] = useState(false);

  const addProductRow = () => {
    setProducts([...products, { productName: "", quantity: "" }]);
  };

  const removeProductRow = (index: number) => {
    if (products.length <= 1) return;
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof ProductRow, value: string) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  const handleSave = async () => {
    if (!invoiceNumber.trim()) {
      toast.error("Invoice number is required");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("udi_registrations" as any).insert({
        invoice_number: invoiceNumber,
        customer_name: customerName,
        date_logged: dateLogged || null,
        invoice_date: invoiceDate || null,
        customer_address: customerAddress || null,
        warranty_term: warrantyTerm || null,
        products: JSON.stringify(products),
      });
      if (error) throw error;
      toast.success("UDI registration saved");
      // Reset form
      setInvoiceNumber("");
      setCustomerName("");
      setDateLogged("");
      setInvoiceDate("");
      setCustomerAddress("");
      setWarrantyTerm("");
      setProducts([{ productName: "", quantity: "" }]);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Safey — Medical Device UDI Registration" subtitle="" />

      {/* Invoice Details */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Invoice Details</h2>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="label-caps">Invoice Number</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-XXXXXX"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Date Logged</Label>
              <Input
                type="date"
                value={dateLogged}
                onChange={(e) => setDateLogged(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Invoice Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Customer Address</Label>
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Customer address"
                rows={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-caps">Select Warranty Term</Label>
              <Select value={warrantyTerm} onValueChange={setWarrantyTerm}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warranty term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_year">1 Year</SelectItem>
                  <SelectItem value="2_year">2 Years</SelectItem>
                  <SelectItem value="3_year">3 Years</SelectItem>
                  <SelectItem value="5_year">5 Years</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Product Details</h2>
            <Button variant="outline" onClick={addProductRow} className="text-primary">
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[13px] text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Select
                        value={row.productName}
                        onValueChange={(v) => updateProduct(i, "productName", v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select product name" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clinic_spirometer">Clinic Spirometer</SelectItem>
                          <SelectItem value="peak_flow_meter">Peak Flow Meter</SelectItem>
                          <SelectItem value="digital_thermometer">Digital Thermometer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.quantity}
                        onChange={(e) => updateProduct(i, "quantity", e.target.value)}
                        placeholder="Enter quantity"
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeProductRow(i)}
                        disabled={products.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
