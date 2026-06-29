import { createClient } from '@supabase/supabase-js';

const cfg = window.APP_CONFIG || {};
const url = cfg.SUPABASE_URL;
const key = cfg.SUPABASE_ANON_KEY;

export const configMissing = !url || !key || url.includes('REPLACE_WITH') || key.includes('REPLACE_WITH');

export const supabase = configMissing
  ? null
  : createClient(url, key);
