// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Récupération sécurisée des variables d'environnement Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Attention : Les variables VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY sont indéfinies. " +
    "Vérifiez votre fichier .env.local ou les Environment Variables sur Vercel."
  );
}

// Exportation de l'instance singleton Supabase
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
