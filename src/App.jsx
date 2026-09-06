import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import Module1Usagers from './components/Module1Usagers';
import Module2Facturation from './components/Module2Facturation';
import Module3Reglements from './components/Module3Reglements';
import Module4Analyses from './components/Module4Analyses';

// LISTE DES PORTS AVEC L'OPTION DE DIRECTION GÉNÉRALE
const PORTS = ['Direction', 'Khemisti', 'Bouharoun', 'Tipaza', 'Cherchell', 'Gouraya'];

export default function App() {
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // Par défaut, le port actif est la Direction ou Bouharoun
  const [activePort, setActivePort] = useState('Direction');
  const [activeTab, setActiveTab] = useState('rapports');

  const [filtreEncaissement, setFiltreEncaissement] = useState('trimestre');

  // Authentification
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Recherche transversale inter-ports
  const [rechercheGlobaleUnite, setRechercheGlobaleUnite] = useState('');

  // Données Supabase
  const [clientsList, setClientsList] = useState([]);
  const [facturesList, setFacturesList] = useState([]);
  const [reglementsList, setReglementsList] = useState([]);
  const [mutationsList, setMutationsList] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchProfile(s.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUserProfile(data);
      if (data.role === 'directeur_unite' || data.port_assigned === 'Direction') {
        setActivePort('Direction');
      } else if (data.port_assigned) {
        setActivePort(data.port_assigned);
      }
    }
  };

  useEffect(() => {
    if (activePort) loadData();
  }, [activePort]);

  const loadData = async () => {
    // 1. Tous les clients de l'Unité
    const { data: clts } = await supabase.from('clients').select('*, embarcations(*)');
    if (clts) setClientsList(clts);

    // 2. Factures : Si "Direction" est sélectionné, on charge TOUTES les factures des 5 ports !
    // Sinon, on filtre sur le port sélectionné.
    let requeteFactures = supabase.from('factures').select('*');
    if (activePort !== 'Direction') {
      requeteFactures = requeteFactures.eq('port', activePort);
    }
    const { data: fcts } = await requeteFactures;
    if (fcts) setFacturesList(fcts);

    // 3. Règlements
    const { data: rgls } = await supabase.from('reglements').select('*');
    if (rgls) setReglementsList(rgls);

    // 4. Mutations
    const { data: muts } = await supabase.from('historique_mutations_navires').select('*').order('date_evenement', { ascending: false });
    if (muts) setMutationsList(muts);
  };

  // =========================================================================
  // GOUVERNANCE ET DROITS D'ACCÈS
  // Le Directeur (ou vue Direction) a le plein pouvoir sur tout.
  // Le Chef de Service a le plein pouvoir uniquement sur son port d'attache.
  // =========================================================================
  const isDirecteur = userProfile?.role === 'directeur_unite' || userProfile?.port_assigned === 'Direction';
  const isPortAssigne = userProfile?.port_assigned === activePort;
  const canEdit = isDirecteur || isPortAssigne || activePort === 'Direction';

  // Calculs calendrier
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarterNum = Math.ceil(currentMonth / 3);
  const currentQuarterName = `${currentQuarterNum} trm`;
  const currentQuarterLabel = `TRM ${currentQuarterNum}`;
  const currentYear = new Date().getFullYear();

  // Indicateurs financiers bandeau
  const totalEmisCeTrimestre = useMemo(() => {
    return facturesList
      .filter(f => f.periode_trimestre === currentQuarterName && f.annee === currentYear)
      .reduce((acc, f) => acc + (parseFloat(f.montant_facture) || 0), 0);
  }, [facturesList, currentQuarterName, currentYear]);

  const totalEmisGlobal = useMemo(() => {
    return facturesList.reduce((acc, f) => acc + (parseFloat(f.montant_facture) || 0), 0);
  }, [facturesList]);

  const totalEncaisseDynamique = useMemo(() => {
    if (filtreEncaissement === 'global') {
      return facturesList.reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
    }
    if (filtreEncaissement === 'mois') {
      return facturesList
        .filter(f => {
          const d = new Date(f.date_facturation);
          return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
    }
    return facturesList
      .filter(f => f.periode_trimestre === currentQuarterName && f.annee === currentYear)
      .reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
  }, [facturesList, filtreEncaissement, currentQuarterName, currentYear, currentMonth]);

  const creanceRestanteCeTrimestre = useMemo(() => {
    const encTrim = facturesList
      .filter(f => f.periode_trimestre === currentQuarterName && f.annee === currentYear)
      .reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
    return totalEmisCeTrimestre - encTrim;
  }, [facturesList, totalEmisCeTrimestre, currentQuarterName, currentYear]);

  const creanceRestanteGlobale = useMemo(() => {
    const encTot = facturesList.reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
    return totalEmisGlobal - encTot;
  }, [facturesList, totalEmisGlobal]);

  const tauxRecouvrementTrimestre = totalEmisCeTrimestre > 0 
    ? (((totalEmisCeTrimestre - creanceRestanteCeTrimestre) / totalEmisCeTrimestre) * 100).toFixed(1)
    : '0.0';

  const nbFacturesSaisiesTrimestre = facturesList.filter(f => f.periode_trimestre === currentQuarterName && f.annee === currentYear).length;
  const nbNouvellesFacturesMois = facturesList.filter(f => {
    const d = new Date(f.date_facturation);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  }).length;
  const nbTotalFacturesPort = facturesList.length;

  // Recherche transversale inter-ports
  const resultatsRechercheUnite = useMemo(() => {
    const q = rechercheGlobaleUnite.toLowerCase().trim();
    if (!q || q.length < 2) return [];
    return clientsList.filter(c =>
      c.code_client?.toLowerCase().includes(q) ||
      c.nom_proprietaire?.toLowerCase().includes(q) ||
      c.nom_prenom?.toLowerCase().includes(q) ||
      c.nin?.toLowerCase().includes(q) ||
      c.embarcations?.some(e => 
        e.nom_embarcation?.toLowerCase().includes(q) || 
        e.immatriculation?.toLowerCase().includes(q)
      )
    ).slice(0, 8);
  }, [clientsList, rechercheGlobaleUnite]);

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={async (e) => {
          e.preventDefault(); setLoading(true);
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) alert(error.message);
          setLoading(false);
        }} className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-4">
          <h1 className="text-xl font-bold text-center text-cyan-400">SGPP TIPAZA — GESTION DES PORTS</h1>
          <input type="email" placeholder="Identifiant professionnel" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-sm text-white" />
          <input type="password" placeholder="Mot de passe" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-sm text-white" />
          <button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500 py-2.5 rounded-lg font-bold text-white text-sm">
            {loading ? 'Connexion...' : 'Accéder au Système'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* HEADER DE GOUVERNANCE AVEC LISTE DÉROULANTE (DIRECTION + 5 PORTS) */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-black text-cyan-400 text-lg tracking-wider">SGPP TIPAZA</span>
          
          {/* SÉLECTEUR AVEC DIRECTION ET LES 5 PORTS */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400">Unité / Port :</span>
            <select
              value={activePort}
              onChange={e => setActivePort(e.target.value)}
              className="bg-transparent font-black text-cyan-300 text-sm outline-none cursor-pointer"
            >
              <option value="Direction" className="bg-slate-900 text-fuchsia-400 font-bold">
                🏛️ Direction de l'Unité (Globalité 5 Ports)
              </option>
              {PORTS.filter(p => p !== 'Direction').map(p => (
                <option key={p} value={p} className="bg-slate-900 text-white font-medium">
                  ⚓ Port de {p} {userProfile?.port_assigned === p ? '★ (Votre Port)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Recherche transversale inter-ports */}
          <div className="relative hidden lg:block">
            <input
              type="text"
              placeholder="🌐 Recherche sur l'ensemble de l'Unité..."
              value={rechercheGlobaleUnite}
              onChange={e => setRechercheGlobaleUnite(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none w-64"
            />
            {resultatsRechercheUnite.length > 0 && (
              <div className="absolute left-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 w-96 divide-y divide-slate-800 p-2">
                <span className="text-[10px] font-bold text-cyan-400 px-2 py-1 block uppercase">
                  Résultats Unité de Tipaza ({resultatsRechercheUnite.length})
                </span>
                {resultatsRechercheUnite.map(r => (
                  <div
                    key={r.id}
                    onClick={() => {
                      const portAttache = r.embarcations?.[0]?.port_attache;
                      if (portAttache && PORTS.includes(portAttache)) {
                        setActivePort(portAttache);
                      }
                      setRechercheGlobaleUnite('');
                    }}
                    className="p-2 text-xs hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-white block">{r.nom_proprietaire} ({r.code_client})</span>
                      <span className="text-[11px] text-slate-400">{r.embarcations?.[0]?.nom_embarcation || 'Local / Terre-plein'}</span>
                    </div>
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded font-mono">
                      Port : {r.embarcations?.[0]?.port_attache || 'Non affecté'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Statut de l'Agent et Badge de Permissions */}
        <div className="flex items-center gap-3">
          {activePort === 'Direction' || isDirecteur ? (
            <span className="text-xs px-3.5 py-1 rounded-full font-black flex items-center gap-1.5 bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-700 shadow-lg">
              👑 DIRECTION GÉNÉRALE DE L'UNITÉ
            </span>
          ) : (
            <span
              className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                canEdit
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border border-amber-800'
              }`}
            >
              {canEdit ? '● MODE MODIFICATION' : '👁 DROIT DE REGARD (CONSULTATION)'}
            </span>
          )}
          
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block">{userProfile?.full_name}</span>
            <span className="text-[10px] text-slate-400">
              {isDirecteur ? "Directeur d'Unité" : `Chef de Service (${userProfile?.port_assigned})`}
            </span>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs bg-red-950 hover:bg-red-900 text-red-300 px-3 py-1 rounded-lg border border-red-800 transition"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* AVERTISSEMENTS DE NAVIGATION */}
      {activePort === 'Direction' && (
        <div className="bg-fuchsia-950/40 border-b border-fuchsia-900/50 px-6 py-2 text-xs text-fuchsia-200 flex items-center justify-between">
          <span>
            🏛️ <strong>Console de Direction Générale :</strong> Affichage consolidé des 5 ports réunis (Khemisti, Bouharoun, Tipaza, Cherchell, Gouraya). Vous disposez des droits complets d'analyse, d'arbitrage et d'exportation officielle.
          </span>
        </div>
      )}

      {activePort !== 'Direction' && !canEdit && (
        <div className="bg-amber-950/60 border-b border-amber-900/60 px-6 py-2 text-xs text-amber-300 flex items-center justify-between">
          <span>
            ℹ️ <strong>Droit de regard actif sur le Port de {activePort} :</strong> Vous consultez les données en lecture seule. Pour modifier ou encaisser, revenez sur votre port d'attache (<strong>{userProfile?.port_assigned}</strong>).
          </span>
          <button
            onClick={() => setActivePort(userProfile?.port_assigned)}
            className="bg-amber-900 hover:bg-amber-800 text-amber-100 font-bold px-2.5 py-0.5 rounded text-[11px] transition"
          >
            Revenir à {userProfile?.port_assigned}
          </button>
        </div>
      )}

      {/* NAVIGATION DES 4 MODULES */}
      <nav className="bg-slate-900/60 border-b border-slate-800 px-6 flex gap-2 overflow-x-auto">
        {[
          { id: 'clients', label: '1. Registre Domanial & Exploitants' },
          { id: 'facturation', label: '2. Émission Facturation (Saisie)' },
          { id: 'suivi', label: '3. Suivi Créances & Encaissements (Guichet)' },
          { id: 'rapports', label: '4. Analyses & Recouvrement (Direction)' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition ${activeTab === tab.id ? 'border-cyan-400 text-cyan-400 bg-slate-800/50' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* BANDEAU SUPÉRIEUR DYNAMIQUE — DOUBLE LIGNE */}
      <div className="p-6 pb-2 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Total Émis ({currentQuarterLabel} - {currentYear})</p>
            <p className="text-xl font-black text-white mt-1">
              {totalEmisCeTrimestre.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Totalité émise cumulée : {totalEmisGlobal.toLocaleString('fr-FR')} DZD</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex justify-between items-center">
              <p className="text-xs text-slate-400">Total Encaissé</p>
              <div className="flex gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
                <button onClick={() => setFiltreEncaissement('trimestre')} className={`px-1.5 py-0.5 rounded ${filtreEncaissement === 'trimestre' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}>Ce Trimestre</button>
                <button onClick={() => setFiltreEncaissement('mois')} className={`px-1.5 py-0.5 rounded ${filtreEncaissement === 'mois' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}>Ce Mois</button>
                <button onClick={() => setFiltreEncaissement('global')} className={`px-1.5 py-0.5 rounded ${filtreEncaissement === 'global' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400'}`}>Tout</button>
              </div>
            </div>
            <p className="text-xl font-black text-emerald-400 mt-1">
              {totalEncaisseDynamique.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Période vue : {filtreEncaissement === 'trimestre' ? `Ce ${currentQuarterLabel}` : filtreEncaissement === 'mois' ? 'Ce mois-ci' : 'Tout le temps'}
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Créances Restantes ({currentQuarterLabel})</p>
            <p className="text-xl font-black text-red-400 mt-1">
              {creanceRestanteCeTrimestre.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Reste global à recouvrer : <span className="text-red-400/80 font-bold">{creanceRestanteGlobale.toLocaleString('fr-FR')} DZD</span>
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-xs text-slate-400">Taux Recouvrement ({currentQuarterLabel})</p>
            <p className="text-xl font-black text-cyan-400 mt-1">{tauxRecouvrementTrimestre} %</p>
            <p className="text-[11px] text-slate-500 mt-1">Périmètre : {activePort === 'Direction' ? "Toute l'Unité (5 Ports)" : activePort}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex justify-between items-center">
            <span className="text-xs text-slate-400">Factures saisies ce Trimestre :</span>
            <span className="text-sm font-mono font-bold text-cyan-300">{nbFacturesSaisiesTrimestre} facture(s)</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex justify-between items-center">
            <span className="text-xs text-slate-400">Nouvelles factures ce Mois :</span>
            <span className="text-sm font-mono font-bold text-emerald-400">{nbNouvellesFacturesMois} facture(s)</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex justify-between items-center">
            <span className="text-xs text-slate-400">Total Factures dans le périmètre :</span>
            <span className="text-sm font-mono font-bold text-white">{nbTotalFacturesPort} au total</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex justify-between items-center">
            <span className="text-xs text-slate-400">Usagers Répertoriés (Unité) :</span>
            <span className="text-sm font-mono font-bold text-cyan-400">{clientsList.length} usager(s)</span>
          </div>
        </div>
      </div>

      {/* CORPS DE L'APPLICATION AVEC LES 4 MODULES */}
      <main className="flex-1 px-6 py-4 pb-12">
        {activeTab === 'clients' && (
          <Module1Usagers
            clientsList={clientsList}
            activePort={activePort === 'Direction' ? 'Bouharoun' : activePort}
            canEdit={canEdit}
            reloadData={loadData}
          />
        )}
        {activeTab === 'facturation' && (
          <Module2Facturation
            clientsList={clientsList}
            facturesList={facturesList}
            activePort={activePort === 'Direction' ? 'Bouharoun' : activePort}
            canEdit={canEdit}
            reloadData={loadData}
          />
        )}
        {activeTab === 'suivi' && (
          <Module3Reglements
            clientsList={clientsList}
            facturesList={facturesList}
            reglementsList={reglementsList}
            activePort={activePort === 'Direction' ? 'Bouharoun' : activePort}
            userProfile={userProfile}
            canEdit={canEdit}
            reloadData={loadData}
          />
        )}
        {activeTab === 'rapports' && (
          <Module4Analyses
            facturesList={facturesList}
            clientsList={clientsList}
            mutationsList={mutationsList}
            activePort={activePort}
            currentYear={currentYear}
            totalEmisGlobal={totalEmisGlobal}
            totalEncaisseDynamique={totalEncaisseDynamique}
            creanceRestanteGlobale={creanceRestanteGlobale}
            tauxRecouvrementTrimestre={tauxRecouvrementTrimestre}
          />
        )}
      </main>
    </div>
  );
}
