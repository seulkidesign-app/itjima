import { createClient } from "@supabase/supabase-js";
import { connectionConfig } from "./config";
const result = connectionConfig(import.meta.env);
export const configError = result.error;
export const supabase = result.config
  ? createClient(result.config.url, result.config.key, {
      auth: {
        storageKey: `itjima-v03-auth-${result.config.ref}`,
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
