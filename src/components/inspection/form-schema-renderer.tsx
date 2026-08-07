import type { FormSchema, FormField } from "@/lib/form-schema";

interface Props {
  schema: FormSchema;
  values?: Record<string, string | number | boolean>;
  onChange?: (key: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}

function FieldRenderer({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FormField;
  value?: string | number | boolean;
  onChange?: (v: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  const displayValue = value !== undefined ? String(value) : "";
  const isPrefilled = !!field.prefill_from_template;
  const effectiveValue = displayValue || field.prefill_from_template || "";
  const canEdit = !readOnly && !isPrefilled;

  if (field.type === "yesno") {
    const selected = effectiveValue || field.default_value?.toString() || "";
    return (
      <div>
        <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
          {field.label}
        </span>
        <div className="flex gap-2">
          {["YES", "NO"].map((opt) => (
            <button
              key={opt}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(opt)}
              className={`px-5 py-1.5 rounded text-[11px] font-semibold border-2 transition-all ${
                selected === opt
                  ? opt === "YES"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              } ${readOnly ? "cursor-default" : "cursor-pointer hover:shadow"}`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
          {field.label}
        </span>
        <input
          type="date"
          value={effectiveValue}
          readOnly={!canEdit}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full h-9 px-3 text-[12px] border-b-2 ${
            canEdit
              ? "bg-white border-slate-300 focus:border-blue-500 focus:outline-none"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        />
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
          {field.label}
        </span>
        <textarea
          value={effectiveValue}
          readOnly={!canEdit}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full h-16 px-3 py-1.5 text-[12px] border-b-2 resize-none ${
            canEdit
              ? "bg-white border-slate-300 focus:border-blue-500 focus:outline-none"
              : "bg-slate-50 border-slate-200 text-slate-500"
          }`}
        />
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div>
        <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
          {field.label}
        </span>
        <div className="border-b-2 border-slate-300 h-8" />
      </div>
    );
  }

  return (
    <div>
      <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1.5">
        {field.label}
        {field.unit && <span className="ml-1 font-normal text-slate-400">({field.unit})</span>}
        {field.required && !readOnly && <span className="ml-1 text-red-400">*</span>}
      </span>
      <input
        type={field.type === "number" ? "number" : "text"}
        value={effectiveValue}
        readOnly={!canEdit}
        onChange={(e) =>
          onChange?.(field.type === "number" ? Number(e.target.value) : e.target.value)
        }
        className={`w-full h-9 px-3 text-[12px] border-b-2 ${
          canEdit
            ? "bg-white border-slate-300 focus:border-blue-500 focus:outline-none"
            : "bg-slate-50 border-slate-200 text-slate-500"
        }`}
        placeholder={canEdit ? field.placeholder || "" : ""}
        min={field.min}
        max={field.max}
      />
    </div>
  );
}

export function FormSchemaRenderer({ schema, values = {}, onChange, readOnly = false }: Props) {
  return (
    <div className="bg-white border border-slate-200 shadow-xl max-w-3xl mx-auto">
      {/* ─── TOP HEADER BAR ─── */}
      <div className="bg-slate-900 text-white px-6 py-3 text-center">
        <h1 className="text-base font-bold tracking-[0.04em]">{schema.form_title}</h1>
        <div className="flex justify-center gap-8 mt-1.5 text-[10px] text-slate-300 font-mono">
          {schema.form_number && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-500">FORM NO:</span>
              {schema.form_number}
            </span>
          )}
          {schema.revision && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-500">REV:</span>
              {schema.revision}
            </span>
          )}
          {schema.metadata?.part_name && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-500">PART:</span>
              {schema.metadata.part_name}
            </span>
          )}
          {schema.metadata?.default_tolerance != null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-500">TOL:</span>
              {schema.metadata.default_tolerance}
            </span>
          )}
        </div>
      </div>

      {/* ─── SECTIONS ─── */}
      <div className="divide-y divide-slate-200">
        {schema.sections.map((section, si) => (
          <div key={si}>
            {/* Section header — dark bar */}
            <div className="bg-slate-700 text-white px-6 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                {si + 1}
              </span>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.06em]">{section.title}</h2>
              {section.description && (
                <span className="text-[10px] text-slate-300 ml-auto italic">
                  {section.description}
                </span>
              )}
            </div>

            {/* Fields grid */}
            <div className="px-6 py-4 bg-white">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {section.fields.map((field, fi) => (
                  <div
                    key={fi}
                    className={
                      field.type === "textarea" || field.type === "table" ? "col-span-2" : ""
                    }
                  >
                    <FieldRenderer
                      field={field}
                      value={values[field.key]}
                      onChange={onChange ? (v) => onChange(field.key, v) : undefined}
                      readOnly={readOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── FOOTER — Signature block ─── */}
      <div className="bg-slate-50 border-t-2 border-slate-300 px-6 py-4">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
              Performed By
            </span>
            <div className="border-b-2 border-slate-300 h-8" />
          </div>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
              Signature
            </span>
            <div className="border-b-2 border-slate-300 h-8" />
          </div>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-1">
              Date
            </span>
            <div className="border-b-2 border-slate-300 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
