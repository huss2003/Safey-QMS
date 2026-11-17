import { supabase } from "@/integrations/supabase/client";
import { createMockSupabase, seedMockTraceability } from "@/lib/mock-supabase";

// Set VITE_MOCK_DATA=true to run the Delivery and Register UDI screens against
// in-memory mock data instead of the live Supabase project.
export const MOCK_DATA = import.meta.env.VITE_MOCK_DATA === "true";

if (MOCK_DATA) seedMockTraceability();

export const db = (MOCK_DATA ? createMockSupabase() : supabase) as unknown as typeof supabase;
