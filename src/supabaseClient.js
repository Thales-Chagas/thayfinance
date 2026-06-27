import { createClient } from "@supabase/supabase-js";

// Endereço público do projeto + chave pública (publishable).
// Estes valores NÃO são segredos — o próprio app no navegador os usa.
const SUPABASE_URL = "https://pgavedcbyrifjolcuhbr.supabase.co";
const SUPABASE_KEY = "sb_publishable_Zw1Luy3DRNzA3gkC8RHdGQ_dd6pbyuG";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
