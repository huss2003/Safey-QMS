import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Upload, Trash2, FileText, MapPin } from "lucide-react";

import { db as supabase } from "@/lib/db";
import { PageHeader } from "@/components/inventory/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/shipment/$id")({
  component: ShipmentDetailPage,
});

const BUCKET = "shipment-photos";
const PHOTOS_PER_STAGE = 2;

const STAGES = [
  { key: "empty_stage", label: "1. Empty Stage" },
  { key: "midway_pack", label: "2. Midway Pack" },
  { key: "before_taping", label: "3. Before Taping" },
  { key: "final_wrap", label: "4. Final Wrap" },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

type PhotoRef = { path: string; name: string };
type PhotoMap = Partial<Record<StageKey, PhotoRef[]>>;

type ShipmentRow = {
  id: string;
  invoice_number: string | null;
  customer_name: string;
  customer_address: string | null;
  ship_to_address: string | null;
  invoice_pdf_name: string | null;
  stage: number;
  verification_photos: PhotoMap | null;
};

const STAGE_LABEL: Record<number, string> = {
  0: "Invoice Created",
  1: "Shipped",
  2: "Delivered",
};

function ShipmentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<StageKey | null>(null);

  const { data: shipment, isLoading, isError } = useQuery({
    queryKey: ["shipment-detail", id],
    queryFn: async (): Promise<ShipmentRow> => {
      const { data, error } = await (supabase.from("udi_registrations" as any) as any)
        .select("id, invoice_number, customer_name, customer_address, ship_to_address, invoice_pdf_name, stage, verification_photos")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as ShipmentRow;
    },
  });

  const photos: PhotoMap = shipment?.verification_photos ?? {};
  const allPaths = STAGES.flatMap((s) => (photos[s.key] ?? []).map((p) => p.path));

  const { data: urls = {} } = useQuery({
    queryKey: ["shipment-photo-urls", id, allPaths.join("|")],
    enabled: allPaths.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {};
      for (const path of allPaths) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) out[path] = data.signedUrl;
      }
      return out;
    },
  });

  const savePhotos = async (next: PhotoMap) => {
    const { error } = await (supabase.from("udi_registrations" as any) as any)
      .update({ verification_photos: next })
      .eq("id", id);
    if (error) throw error;
    queryClient.setQueryData(["shipment-detail", id], (old: ShipmentRow | undefined) =>
      old ? { ...old, verification_photos: next } : old,
    );
    queryClient.invalidateQueries({ queryKey: ["shipment-photo-urls", id] });
  };

  const uploadPhotos = async (stage: StageKey, files: File[]) => {
    const existing = photos[stage] ?? [];
    const room = PHOTOS_PER_STAGE - existing.length;
    if (room <= 0) return toast.error(`${STAGES.find((s) => s.key === stage)?.label} already has ${PHOTOS_PER_STAGE} photos`);
    if (files.length > room) return toast.error(`Only ${room} more photo${room === 1 ? "" : "s"} allowed here`);
    if (files.some((f) => !f.type.startsWith("image/"))) return toast.error("Upload image files only");

    setBusy(stage);
    try {
      const added: PhotoRef[] = [];
      for (const file of files) {
        const path = `${id}/${stage}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type,
        });
        if (error) throw error;
        added.push({ path, name: file.name });
      }
      await savePhotos({ ...photos, [stage]: [...existing, ...added] });
      toast.success(`${added.length} photo${added.length === 1 ? "" : "s"} uploaded`);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = async (stage: StageKey, ref: PhotoRef) => {
    setBusy(stage);
    try {
      await supabase.storage.from(BUCKET).remove([ref.path]);
      await savePhotos({
        ...photos,
        [stage]: (photos[stage] ?? []).filter((p) => p.path !== ref.path),
      });
      toast.success("Photo removed");
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove photo");
    } finally {
      setBusy(null);
    }
  };

  if (isError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Shipment not found.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/delivery" })}>Back to Delivery</Button>
      </div>
    );
  }

  if (isLoading || !shipment) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  }

  const finalWrapDone = (photos.final_wrap ?? []).length > 0;
  const total = STAGES.length * PHOTOS_PER_STAGE;
  const done = STAGES.reduce((n, s) => n + Math.min((photos[s.key] ?? []).length, PHOTOS_PER_STAGE), 0);
  const complete = done === total;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate({ to: "/delivery" })}
          aria-label="Back to Delivery"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader subtitle="Delivery" title={`Shipment ${shipment.invoice_number ?? ""}`} />
        <Badge variant="outline" className="ml-auto">
          {STAGE_LABEL[shipment.stage] ?? shipment.stage}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AddressCard title="Bill To" name={shipment.customer_name} address={shipment.customer_address} />
        <AddressCard
          title="Ship To"
          name={shipment.customer_name}
          address={shipment.ship_to_address ?? shipment.customer_address}
        />
      </div>

      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Invoice PDF:</span>
          <span>{shipment.invoice_pdf_name ?? "Not uploaded"}</span>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Verification Photos
          </h2>
          {complete ? (
            <Badge className="bg-green-600 text-white hover:bg-green-600">All photos uploaded</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{done} of {total} uploaded</span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {STAGES.map((s) => (
            <StageCard
              key={s.key}
              label={s.label}
              refs={photos[s.key] ?? []}
              urls={urls}
              isBusy={busy === s.key}
              anyBusy={busy !== null}
              onUpload={(files) => uploadPhotos(s.key, files)}
              onRemove={(ref) => removePhoto(s.key, ref)}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col items-end gap-2">
        {!finalWrapDone && (
          <p className="text-sm text-muted-foreground">Upload at least one Final Wrap photo to continue.</p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/delivery" })}>
            Back to Delivery
          </Button>
          <Button
            disabled={!finalWrapDone}
            onClick={() => navigate({ to: "/shipment-dispatch/$id", params: { id } })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddressCard({ title, name, address }: { title: string; name: string; address: string | null }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {title}
        </p>
        <p className="font-medium">{name}</p>
        <p className="whitespace-pre-line text-sm text-muted-foreground">{address || "No address saved"}</p>
      </CardContent>
    </Card>
  );
}

function StageCard({
  label,
  refs,
  urls,
  isBusy,
  anyBusy,
  onUpload,
  onRemove,
}: {
  label: string;
  refs: PhotoRef[];
  urls: Record<string, string>;
  isBusy: boolean;
  anyBusy: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (ref: PhotoRef) => void;
}) {
  const full = refs.length >= PHOTOS_PER_STAGE;
  const disabled = full || anyBusy;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-center text-sm font-semibold uppercase tracking-wide">{label}</p>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: PHOTOS_PER_STAGE }, (_, i) => refs[i]).map((ref, i) =>
            ref ? (
              <div key={ref.path} className="relative aspect-[4/3] overflow-hidden rounded-md border bg-muted">
                {urls[ref.path] ? (
                  <img src={urls[ref.path]} alt={ref.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">Loading…</div>
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => onRemove(ref)}
                  disabled={anyBusy}
                  aria-label={`Remove ${ref.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                key={`empty-${i}`}
                className="grid aspect-[4/3] place-items-center rounded-md border border-dashed text-xs text-muted-foreground"
              >
                Photo {i + 1}
              </div>
            ),
          )}
        </div>
        <label
          className={cn(
            "flex cursor-pointer items-center justify-center gap-2 rounded-md border py-2 text-sm font-medium hover:bg-muted",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <Upload className="h-4 w-4" />
          {isBusy ? "Uploading…" : full ? "Photos complete" : "Upload"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.currentTarget.value = "";
              if (files.length) onUpload(files);
            }}
          />
        </label>
      </CardContent>
    </Card>
  );
}
