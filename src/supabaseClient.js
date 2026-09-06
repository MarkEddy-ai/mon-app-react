import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfxifqjnzdfqtcrtedof.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmeGlmcWpuemRmcXRjcnRlZG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NTczNTYsImV4cCI6MjEwNDEzMzM1Nn0.PHMDWBg_b51BsoQ-XJnMl15PYx8lr304LfYYeNzIghs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
