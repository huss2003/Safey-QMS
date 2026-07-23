import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

declare global {
  interface Window {
    __TRACE_DEMO?: boolean;
  }
}

interface SearchResult {
  vendors: { id: string; name: string }[];
  raw_materials: { id: string; batch_number: string; material_type: string }[];
  parts: { id: string; part_name: string }[];
  products: { id: string; product_name: string; product_code: string }[];
  production_batches: { id: string; batch_number: string }[];
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQ = useDebouncedValue(q, 300);

  // Listen for global keyboard shortcut to focus search
  useEffect(() => {
    function onFocusSearch() {
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("keyboard:focus-search", onFocusSearch);
    return () => window.removeEventListener("keyboard:focus-search", onFocusSearch);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQ],
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<SearchResult> => {
      if (typeof window !== "undefined" && window.__TRACE_DEMO) {
        return {
          vendors: [],
          raw_materials: [],
          parts: [],
          products: [],
          production_batches: [],
        };
      }
      const [v, r, p, pr, pb] = await Promise.all([
        supabase.from("vendors").select("id,name").ilike("name", `%${debouncedQ}%`).limit(5),
        supabase
          .from("raw_materials")
          .select("id,batch_number,material_type")
          .ilike("batch_number", `%${debouncedQ}%`)
          .limit(5),
        supabase
          .from("parts")
          .select("id,part_name")
          .ilike("part_name", `%${debouncedQ}%`)
          .limit(5),
        supabase
          .from("products")
          .select("id,product_name,product_code")
          .or(`product_name.ilike.%${debouncedQ}%,product_code.ilike.%${debouncedQ}%`)
          .limit(5),
        supabase
          .from("production_batches")
          .select("id,batch_number")
          .ilike("batch_number", `%${debouncedQ}%`)
          .limit(5),
      ]);

      return {
        vendors: (v.data ?? []) as SearchResult["vendors"],
        raw_materials: (r.data ?? []) as SearchResult["raw_materials"],
        parts: (p.data ?? []) as SearchResult["parts"],
        products: (pr.data ?? []) as SearchResult["products"],
        production_batches: (pb.data ?? []) as SearchResult["production_batches"],
      };
    },
  });

  const hasResults =
    data &&
    data.vendors.length +
      data.raw_materials.length +
      data.parts.length +
      data.products.length +
      data.production_batches.length >
      0;

  const handleNavigate = useCallback(
    (to: string) => {
      navigate({ to: to as any });
      setOpen(false);
      setQ("");
    },
    [navigate],
  );

  return (
    <div
      className="relative"
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls="search-results"
    >
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        placeholder="Search vendors, batches, parts, products…  ( /  to focus)"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="pl-8 h-8 text-[13px] bg-secondary border-border"
        aria-label="Global search"
        aria-autocomplete="list"
        aria-controls="search-results"
        role="searchbox"
      />
      {q && (
        <button
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && q.length >= 2 && (
        <div
          id="search-results"
          role="listbox"
          className="absolute top-full mt-1 w-full bg-popover border border-border rounded shadow-md z-50 max-h-96 overflow-y-auto"
        >
          {isFetching && (
            <div className="p-3 text-[12.5px] text-muted-foreground text-center">Searching…</div>
          )}
          {!isFetching && !hasResults && (
            <div className="p-3 text-[12.5px] text-muted-foreground text-center">
              No results for "{debouncedQ}"
            </div>
          )}
          {data &&
            !isFetching &&
            Object.entries({
              Vendors: data.vendors.map((v) => ({
                key: v.id,
                label: v.name,
                sub: "vendor" as const,
                to: "/vendors" as const,
              })),
              "Raw materials": data.raw_materials.map((r) => ({
                key: r.id,
                label: r.batch_number,
                sub: r.material_type,
                to: "/raw-materials" as const,
              })),
              Parts: data.parts.map((p) => ({
                key: p.id,
                label: p.part_name,
                sub: "part" as const,
                to: "/parts" as const,
              })),
              Products: data.products.map((p) => ({
                key: p.id,
                label: p.product_name,
                sub: p.product_code,
                to: "/products" as const,
              })),
              "Production batches": data.production_batches.map((pb) => ({
                key: pb.id,
                label: pb.batch_number,
                sub: "batch" as const,
                to: "/production" as const,
              })),
            }).map(
              ([group, items]) =>
                items.length > 0 && (
                  <div key={group}>
                    <div className="px-3 py-1.5 label-caps bg-muted" role="presentation">
                      {group}
                    </div>
                    {items.map((it) => (
                      <button
                        key={it.key}
                        onMouseDown={() => handleNavigate(it.to)}
                        className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-accent flex items-baseline gap-2"
                        role="option"
                        aria-selected={false}
                      >
                        <span className="font-medium truncate">{it.label}</span>
                        {it.sub && (
                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                            {it.sub}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ),
            )}
        </div>
      )}
    </div>
  );
}
