import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ── Config ──────────────────────────────────────────────────────
const MIMO_URL = "https://api.xiaomimimo.com/v1/chat/completions";
const MODEL = "mimo-v2.5";

interface GenerateRequest {
  docxText: string;
  fileName?: string;
}

interface FormField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "yesno" | "date" | "textarea" | "signature" | "section" | "table" | "image";
  required: boolean;
  placeholder?: string;
  default_value?: string | number | boolean;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
  prefill_from_template?: string;
}

interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
}

interface FormSchema {
  form_title: string;
  form_number?: string;
  revision?: string;
  sections: FormSection[];
  metadata?: {
    part_name?: string;
    equipment_name?: string;
    default_tolerance?: number;
  };
}

interface GenerateResponse {
  schema: FormSchema;
  raw_text: string;
  model_used: string;
}

// ── System prompt ───────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a QC form document analyzer for a medical device manufacturing company.
Your job is to parse raw text extracted from a .docx inspection template and output a structured JSON schema.

OUTPUT EXACTLY this JSON structure (no markdown, no code fences, no commentary):

{
  "form_title": "string — form name",
  "form_number": "string — document ID like QC_01-Top, FORM_PSP_QI_13, or null",
  "revision": "string or null",
  "sections": [
    {
      "title": "string — section name like Process Equipment Details",
      "description": "string or null",
      "fields": [
        {
          "key": "snake_case_identifier",
          "label": "Field Label As It Appears",
          "type": "text|number|select|yesno|date|textarea|signature|table|image",
          "required": true,
          "placeholder": "",
          "options": [],
          "unit": "bar|C|kN|mm|Sec or null",
          "prefill_from_template": "pre-filled value or null"
        }
      ]
    }
  ],
  "metadata": {
    "part_name": "string or null",
    "equipment_name": "string or null",
    "default_tolerance": null
  }
}

FIELD RULES:
- Section names from the document → "title" field (NOT "section_name" or "label")
- Tables with checkboxes (Sl No, criteria, Result) → type: "table"
- YES/NO options → type: "yesno", options: ["YES", "NO"]
- Empty fields → type: "text" or "number"
- Date fields → type: "date"
- Signature fields → type: "signature"
- Measurement units → unit field (e.g. "bar", "C", "kN")
- Pre-filled values → prefill_from_template field
- Group related fields under sections`;

// ── Handler ─────────────────────────────────────────────────────
serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("MIMO_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "MIMO_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: GenerateRequest = await req.json();
    const { docxText, fileName } = body;

    if (!docxText || docxText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "docxText is required and must contain content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Truncate extremely long documents (MiMo has 128K context, but keep it reasonable)
    const truncated = docxText.slice(0, 40000);

    // Call MiMo API (OpenAI-compatible)
    const response = await fetch(MIMO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Parse this inspection form document text and return a structured JSON schema:\n\n${truncated}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return new Response(JSON.stringify({
        error: `MiMo API error: ${response.status}`,
        details: errorBody,
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({
        error: "No content in AI response",
        raw_response: data,
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse the AI response — it should be JSON directly
    let schema: FormSchema;
    try {
      schema = JSON.parse(content.replace(/```json|```/g, "").trim());
    } catch {
      // If AI returned malformed JSON, return raw text so admin can still work
      return new Response(JSON.stringify({
        error: "Failed to parse AI response as JSON",
        raw_text: truncated,
        ai_response: content,
      } as GenerateResponse), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure minimum structure
    if (!schema.sections) schema.sections = [];
    if (!schema.form_title) schema.form_title = fileName?.replace(/\.docx$/i, "") ?? "Untitled Form";

    const result: GenerateResponse = {
      schema,
      raw_text: truncated,
      model_used: MODEL,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
