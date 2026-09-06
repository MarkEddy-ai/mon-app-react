// src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import Module1Usagers from './components/Module1Usagers';
import Module2Facturation from './components/Module2Facturation';
import Module3Reglements from './components/Module3Reglements';
import Module4Analyses from './components/Module4Analyses';

// Intégration du composant de traçabilité de version
import VersionBadge from './components/VersionBadge';

// Liste officielle des unités portuaires et direction générale
const PORTS = ['Direction', 'Khemisti', 'Bouharoun', 'Tipaza', 'Cherchell', 'Gouraya'];

export default function App() {
  // États d'authentification et profil utilisateur
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Navigation et filtres de contexte
  const [activePort, setActivePort] = useState('Direction');
  const [activeTab, setActiveTab] = useState('usagers'); // 'usagers' | 'facturation' | 'reglements' | 'rapports'
  const [filtreEncaissement, setFiltreEncaissement] = useState('trimestre');

  // Données globales
  const [clientsList, setClientsList] = useState([]);
  const [chargementDonnees, setChargementDonnees] = useState(false);

  // Droits de modification basés sur le port assigné
  const canEdit = useMemo(() => {
    if (!userProfile) return true; // Mode développement / fallback
    if (userProfile.role === 'admin' || userProfile.port_assigne === 'Direction') return true;
    return userProfile.port_assigne === activePort;
  }, [userProfile, activePort]);

  // Chargement des données métier depuis Supabase
  const rechargerDonnees = async () => {
    try {
      setChargementDonnees(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*, embarcations(*)');

      if (error) throw error;
      setClientsList(data || []);
    } catch (err) {
      console.error('[SGPP] Erreur lors du chargement des données:', err.message);
    } finally {
      setChargementDonnees(false);
    }
  };

  // Écoute de l'état d'authentification Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession) {
        rechargerDonnees();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        rechargerDonnees();
      }
    });

    // Chargement initial des données
    rechargerDonnees();

    return () => subscription.unsubscribe();
  }, []);

  // Gestion de la connexion utilisateur
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setAuthError(err.message || 'Échec de connexion aux services portuaires.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-white">
      {/* Header Supérieur / Barre Institutionnelle */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo, Titre & Badge de Version */}
          <div className="flex items-center gap-3.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              ⚓
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-sm font-black tracking-tight text-white uppercase">
                  SGPP <span className="text-cyan-400 font-semibold normal-case text-xs">Port Management</span>
                </h1>
                {/* Badge Version avec statut animé */}
                <VersionBadge />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Système de Gestion Domaniale & Recouvrement des Créances
              </p>
            </div>
          </div>

          {/* Contrôles de Contexte : Sélecteur de Port & Session */}
          <div className="flex items-center gap-3">
            {/* Sélecteur de Port */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-1 pl-2.5 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Port :</span>
              <select
                value={activePort}
                onChange={(e) => setActivePort(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 text-cyan-300 font-bold px-3 py-1 rounded-lg text-xs outline-none focus:border-cyan-500 transition cursor-pointer"
              >
                {PORTS.map((port) => (
                  <option key={port} value={port}>
                    {port === 'Direction' ? '🏢 Vue Globale (Direction)' : `Port de ${port}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Déconnexion si session active */}
            {session && (
              <button
                type="button"
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-red-950/50 hover:text-red-400 hover:border-red-800/80 text-slate-300 text-xs px-3 py-1.5 rounded-xl border border-slate-700 transition"
                title="Déconnexion de la session"
              >
                🚪 Quitter
              </button>
            )}
          </div>
        </div>

        {/* Barre de Navigation par Onglets (Modules Métier) */}
        <div className="border-t border-slate-800/60 bg-slate-900/40 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto py-2">
            <button
              type="button"
              onClick={() => setActiveTab('usagers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'usagers'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              📋 Module 1 : Registre Domanial
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('facturation')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'facturation'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              🧾 Module 2 : Facturation
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reglements')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'reglements'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              💳 Module 3 : Règlements & Caisse
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rapports')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'rapports'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              📊 Module 4 : Analyses & Créances
            </button>
          </div>
        </div>
      </header>

      {/* Zone de Travail Principale */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'usagers' && (
          <Module1Usagers
            clientsList={clientsList}
            activePort={activePort}
            canEdit={canEdit}
            reloadData={rechargerDonnees}
          />
        )}

        {activeTab === 'facturation' && (
          <Module2Facturation
            clientsList={clientsList}
            activePort={activePort}
            canEdit={canEdit}
            reloadData={rechargerDonnees}
          />
        )}

        {activeTab === 'reglements' && (
          <Module3Reglements
            clientsList={clientsList}
            activePort={activePort}
            canEdit={canEdit}
            reloadData={rechargerDonnees}
          />
        )}

        {activeTab === 'rapports' && (
          <Module4Analyses
            clientsList={clientsList}
            activePort={activePort}
            filtreEncaissement={filtreEncaissement}
            setFiltreEncaissement={setFiltreEncaissement}
          />
        )}
      </main>

      {/* Pied de Page Institutionnel */}
      <footer className="border-t border-slate-800/80 bg-slate-900/30 py-3 text-center text-xs text-slate-500 font-medium">
        Unité Portuaire de Tipaza — Système d'Information Domaniale & Recouvrement
      </footer>
    </div>
  );
}
