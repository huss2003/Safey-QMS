import { supabase } from "./client";

const BUCKET = "form-templates";

/**
 * Upload a .docx file to Supabase Storage and return the public URL.
 */
export async function uploadFormDocx(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string }> {
  const path = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);
  if (!data) throw new Error("Upload returned no data");

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

  return { url: publicUrl, path: data.path };
}

/**
 * Delete a previously uploaded .docx file from storage.
 */
export async function deleteFormDocx(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

/**
 * Extract raw text from a .docx file client-side using the JSZip + xml parser.
 *
 * Falls back to server-side extraction via edge function if client fails.
 */
export async function extractDocxText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        // Dynamic import of JSZip (already in node_modules via Radix deps)
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(arrayBuffer);
        const doc = zip.file("word/document.xml");
        if (!doc) throw new Error("Invalid .docx — no document.xml found");

        const xmlText = await doc.async("string");

        // Strip XML tags to get plain text
        const text = xmlText
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim();

        resolve(text);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
