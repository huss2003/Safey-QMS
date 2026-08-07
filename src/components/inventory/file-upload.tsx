import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  bucket?: string;
  pathPrefix: string;
  onFilesChange: (urls: string[]) => void;
  existingUrls?: string[];
  maxFiles?: number;
  accept?: string;
}

export function FileUpload({
  bucket = "equipment-files",
  pathPrefix,
  onFilesChange,
  existingUrls = [],
  maxFiles = 5,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [urls, setUrls] = useState<string[]>(existingUrls);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${pathPrefix}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const newUrls = [...urls, urlData.publicUrl];
      setUrls(newUrls);
      onFilesChange(newUrls);
    } catch (err: any) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (i: number) => {
    const next = urls.filter((_, idx) => idx !== i);
    setUrls(next);
    onFilesChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[12px] bg-muted rounded px-2 py-1 max-w-[200px]"
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{url.split("/").pop()}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {urls.length < maxFiles && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[12px]"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            <span className="ml-1">{uploading ? "Uploading…" : "Upload"}</span>
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
      {urls.length > 0 && (
        <p className="text-[11px] text-muted-foreground">{urls.length} file(s) uploaded</p>
      )}
    </div>
  );
}

export function FileList({ urls }: { urls: string[] | null | undefined }) {
  if (!urls || urls.length === 0)
    return <span className="text-muted-foreground text-[12px]">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline bg-primary/5 rounded px-2 py-0.5"
        >
          <FileText className="h-3 w-3" />
          <span className="truncate max-w-[140px]">{url.split("/").pop() || `Doc ${i + 1}`}</span>
        </a>
      ))}
    </div>
  );
}
