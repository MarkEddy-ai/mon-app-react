import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Module3Reglements({
  clientsList = [],
  facturesList = [],
  reglementsList = [],
  activePort = 'Bouharoun',
  userProfile = null,
  canEdit = false,
  reloadData = () => {}
}) {
  const [rechercheGuichet, setRechercheGuichet] = useState('');
  const [usagerSelectionne, setUsagerSelectionne] = useState(null);
  const [factureEnCoursPaiement, setFactureEnCoursPaiement] = useState(null);

  // Formulaire d'encaissement spécifique Guichet / Caisse
  const [formCaisse, setFormCaisse] = useState({
    numero_recu: '',
    numero_piece_caisse: '',
    montant_verse: '',
    mode_reglement: 'espece', // 'espece' | 'cheque' | 'virement'
    reference_bancaire: '',
    banque_emetteur: '',
    date_versement: new Date().toISOString().slice(0, 10)
  });

  // 1. Filtrage et sélection usager au guichet
  const usagersTrouves = useMemo(() => {
    const q = rechercheGuichet.toLowerCase().trim();
    if (!q) return clientsList;
    return clientsList.filter(c =>
      c.code_client?.toLowerCase().includes(q) ||
      c.nom_proprietaire?.toLowerCase().includes(q) ||
      c.nom_prenom?.toLowerCase().includes(q) ||
      c.embarcations?.some(e => 
        e.nom_embarcation?.toLowerCase().includes(q) || 
        e.immatriculation?.toLowerCase().includes(q)
      )
    );
  }, [clientsList, rechercheGuichet]);

  // Présélection automatique dès la première recherche
  useEffect(() => {
    if (usagersTrouves.length > 0 && !usagerSelectionne) {
      setUsagerSelectionne(usagersTrouves[0]);
    } else if (usagersTrouves.length > 0 && usagerSelectionne) {
      const persiste = usagersTrouves.find(c => c.id === usagerSelectionne.id);
      if (!persiste) setUsagerSelectionne(usagersTrouves[0]);
    }
  }, [usagersTrouves]);

  // 2. Données financières de l'usager sélectionné
  const facturesUsager = useMemo(() => {
    if (!usagerSelectionne) return [];
    return facturesList.filter(f => f.code_client === usagerSelectionne.code_client);
  }, [facturesList, usagerSelectionne]);

  const reglementsUsager = useMemo(() => {
    if (!usagerSelectionne) return [];
    return reglementsList.filter(r => r.code_client === usagerSelectionne.code_client);
  }, [reglementsList, usagerSelectionne]);

  // Calculs consolidés en temps réel
  const totalFactureGlobal = facturesUsager.reduce((acc, f) => acc + (parseFloat(f.montant_facture) || 0), 0);
  const totalEncaisseGlobal = facturesUsager.reduce((acc, f) => acc + (parseFloat(f.montant_encaisse) || 0), 0);
  const soldeRestantDu = totalFactureGlobal - totalEncaisseGlobal;

  const nbFacturesSoldees = facturesUsager.filter(f => f.statut_paiement === 'a_jour').length;
  const nbFacturesImpayees = facturesUsager.filter(f => f.statut_paiement !== 'a_jour').length;

  // 3. Déclenchement de l'acte d'encaissement sur une facture
  const handleOuvrirEncaissement = (facture) => {
    setFactureEnCoursPaiement(facture);
    const resteAFacture = parseFloat(facture.solde_restant) || 0;
    setFormCaisse({
      numero_recu: `REC-${activePort.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      numero_piece_caisse: `PC-${Date.now().toString().slice(-5)}`,
      montant_verse: resteAFacture > 0 ? resteAFacture : '',
      mode_reglement: 'espece',
      reference_bancaire: '',
      banque_emetteur: '',
      date_versement: new Date().toISOString().slice(0, 10)
    });
  };

  // 4. Validation et insertion du versement
  const handleExecuterEncaissement = async (e) => {
    e.preventDefault();
    if (!canEdit) return alert('Action refusée : Mode Consultation actif.');
    if (!factureEnCoursPaiement) return alert('Aucune facture sélectionnée.');

    const versement = parseFloat(formCaisse.montant_verse) || 0;
    const resteDu = parseFloat(factureEnCoursPaiement.solde_restant) || 0;

    if (versement <= 0) return alert('Le montant versé doit être supérieur à 0 DZD.');
    if (versement > resteDu) {
      if (!window.confirm(`Le montant (${versement.toLocaleString()} DZD) dépasse le reste dû (${resteDu.toLocaleString()} DZD). Confirmer le paiement ?`)) {
        return;
      }
    }

    const payloadReglement = {
      numero_recu: formCaisse.numero_recu,
      facture_id: factureEnCoursPaiement.id,
      code_client: usagerSelectionne.code_client,
      montant_verse: versement,
      mode_reglement: formCaisse.mode_reglement,
      reference_paiement: formCaisse.mode_reglement === 'espece' 
        ? `Pièce Caisse: ${formCaisse.numero_piece_caisse}`
        : `${formCaisse.mode_reglement.toUpperCase()}: ${formCaisse.reference_bancaire || 'N/A'} (${formCaisse.banque_emetteur || 'Banque'})`,
      date_reglement: formCaisse.date_versement,
      agent_encaisseur: userProfile?.full_name || 'Caissier SGPP'
    };

    try {
      const { error } = await supabase.from('reglements').insert([payloadReglement]);
      if (error) throw error;

      alert(`Versement de ${versement.toLocaleString('fr-FR')} DZD enregistré avec succès.`);
      setFactureEnCoursPaiement(null);
      reloadData();
    } catch (err) {
      alert('Erreur lors de la comptabilisation : ' + err.message);
    }
  };

  // 5. Édition Quitus officiel de situation
  const handleImprimerQuitus = () => {
    if (!usagerSelectionne || soldeRestantDu > 0) return;
    const win = window.open('', '', 'width=850,height=650');
    win.document.write(`
      <html>
        <head>
          <title>Quitus Portuaire - ${usagerSelectionne.code_client}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            .entete { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
            .titre { text-align: center; text-decoration: underline; margin: 30px 0; font-size: 18px; }
            .box-client { border: 1px solid #333; padding: 15px; background: #f9f9f9; margin-bottom: 30px; }
            .signature { margin-top: 60px; display: flex; justify-content: space-between; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="entete">
            <h3>ENTREPRISE DE GESTION DES PORTS DE PÊCHE — SGPP</h3>
            <h4>UNITÉ DE TIPAZA — PORT DE ${activePort.toUpperCase()}</h4>
            <p>SERVICE RECOUVREMENT & RÉGIE DES RECETTES</p>
          </div>

          <h2 class="titre">ATTESTATION D'APUREMENT DES COMPTES (QUITUS)</h2>

          <p>Le Chef de Service et le Responsable de Caisse certifient par la présente que :</p>
          
          <div class="box-client">
            <p><strong>Usager / Armateur :</strong> ${usagerSelectionne.nom_proprietaire}</p>
            <p><strong>Code Client :</strong> ${usagerSelectionne.code_client}</p>
            <p><strong>Immatriculation / Bien :</strong> ${usagerSelectionne.embarcations?.[0]?.immatriculation || usagerSelectionne.nom_bien || 'Emplacement portuaire'}</p>
            <p><strong>N° NIN :</strong> ${usagerSelectionne.nin || '-'}</p>
          </div>

          <p>Est intégralement <strong>À JOUR</strong> de ses redevances portuaires au ${new Date().toLocaleDateString('fr-FR')}.</p>
          <p>Toutes les factures trimestrielles échues jusqu'à ce jour présentent un solde restant dû de <strong>0,00 DZD</strong>.</p>
          <p>Cette attestation est délivrée pour servir et valoir ce que de droit.</p>

          <div class="signature">
            <div>Le Caissier / Agent de Recouvrement</div>
            <div>Le Chef de Service Portuaire<br/>(Cachet officiel)</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">

      {/* BLOC 1 : BARRE DE RECHERCHE DE L'USAGER AU GUICHET */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="w-full md:w-96">
          <label className="text-xs font-bold text-cyan-400 block mb-1">
            🔍 Identifier l'Usager au Guichet (Paiement)
          </label>
          <input
            type="text"
            placeholder="Taper nom armateur, code client ou immatriculation..."
            value={rechercheGuichet}
            onChange={e => setRechercheGuichet(e.target.value)}
            className="w-full bg-slate-950 border border-cyan-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400 outline-none"
          />
        </div>

        <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-1">
          {usagersTrouves.slice(0, 6).map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => { setUsagerSelectionne(u); setFactureEnCoursPaiement(null); }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex flex-col text-left ${usagerSelectionne?.id === u.id ? 'bg-cyan-600 text-white shadow-lg' : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'}`}
            >
              <span className="font-mono text-[11px]">[{u.code_client}]</span>
              <span className="truncate max-w-[120px]">{u.nom_proprietaire}</span>
            </button>
          ))}
        </div>
      </div>

      {/* BLOC 2 : FICHE DU DÉBITEUR ET COMPTEURS CONSOLIDÉS */}
      {usagerSelectionne && (
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex flex-wrap justify-between items-start border-b border-slate-800 pb-4 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Dossier Débiteur Actif</span>
                <h2 className="text-xl font-black text-white">{usagerSelectionne.nom_proprietaire}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Code : <span className="font-mono font-bold text-cyan-300">{usagerSelectionne.code_client}</span> | 
                  NIN : <span className="text-slate-300">{usagerSelectionne.nin || '-'}</span> | 
                  Tél : <span className="text-slate-300">{usagerSelectionne.telephone || '-'}</span>
                </p>
                <p className="text-xs text-slate-400">
                  Bien rattaché : <span className="text-white font-medium">{usagerSelectionne.embarcations?.[0]?.nom_embarcation || usagerSelectionne.nom_bien || 'Local / Terre-plein'}</span>
                  {usagerSelectionne.embarcations?.[0]?.immatriculation && (
                    <span className="font-mono text-cyan-300"> ({usagerSelectionne.embarcations[0].immatriculation})</span>
                  )}
                </p>
              </div>

              {/* Compteurs consolidés */}
              <div className="flex flex-wrap gap-3">
                <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Facturé</span>
                  <span className="text-sm font-mono font-bold text-white">{totalFactureGlobal.toLocaleString('fr-FR')} DZD</span>
                </div>
                <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Encaissé</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">{totalEncaisseGlobal.toLocaleString('fr-FR')} DZD</span>
                </div>
                <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Reste Dû Net</span>
                  <span className={`text-sm font-mono font-black ${soldeRestantDu > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {soldeRestantDu.toLocaleString('fr-FR')} DZD
                  </span>
                </div>
                <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Situation</span>
                  <span className="text-xs font-bold text-slate-300">
                    {nbFacturesSoldees} soldée(s) / <span className="text-amber-400">{nbFacturesImpayees} due(s)</span>
                  </span>
                </div>
                {soldeRestantDu === 0 && totalFactureGlobal > 0 && (
                  <button
                    type="button"
                    onClick={handleImprimerQuitus}
                    className="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 py-2 rounded-xl text-xs text-white shadow-lg flex items-center gap-2"
                  >
                    🖨 Délivrer Quitus
                  </button>
                )}
              </div>
            </div>

            {/* BLOC 3 : FORMULAIRE D'ENCAISSEMENT & PIÈCE DE CAISSE (SI FACTURE CHARGÉE) */}
            {factureEnCoursPaiement && (
              <form onSubmit={handleExecuterEncaissement} className="bg-slate-950 p-5 rounded-xl border-2 border-cyan-500 space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-wide">
                      💵 Caisse : Encaissement de la Facture {factureEnCoursPaiement.numero_facture}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">({factureEnCoursPaiement.periode_trimestre} {factureEnCoursPaiement.annee})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFactureEnCoursPaiement(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    ✕ Annuler l'encaissement
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* N° Reçu Quittance */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">N° Reçu Quittance *</label>
                    <input
                      required
                      value={formCaisse.numero_recu}
                      onChange={e => setFormCaisse({...formCaisse, numero_recu: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono"
                    />
                  </div>

                  {/* Mode de règlement */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Mode de Règlement *</label>
                    <select
                      value={formCaisse.mode_reglement}
                      onChange={e => setFormCaisse({...formCaisse, mode_reglement: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-bold"
                    >
                      <option value="espece">Espèces (Pièce de Caisse)</option>
                      <option value="cheque">Chèque Bancaire</option>
                      <option value="virement">Virement Bancaire</option>
                    </select>
                  </div>

                  {/* Montant versé */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">
                      Montant Versé (DZD) * <span className="text-slate-500 font-normal">(Reste: {factureEnCoursPaiement.solde_restant} DZD)</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formCaisse.montant_verse}
                      onChange={e => setFormCaisse({...formCaisse, montant_verse: e.target.value})}
                      className="w-full bg-slate-900 border border-cyan-500 p-2 rounded text-xs text-emerald-400 font-mono font-bold"
                    />
                  </div>

                  {/* Date du versement */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-bold block mb-1">Date du Versement *</label>
                    <input
                      type="date"
                      required
                      value={formCaisse.date_versement}
                      onChange={e => setFormCaisse({...formCaisse, date_versement: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white"
                    />
                  </div>
                </div>

                {/* Champs conditionnels selon le mode de paiement */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                  {formCaisse.mode_reglement === 'espece' ? (
                    <div>
                      <label className="text-[11px] text-cyan-300 font-bold block mb-1">
                        N° Pièce de Caisse (Régie des recettes) *
                      </label>
                      <input
                        required
                        placeholder="ex: PC-2026-0042"
                        value={formCaisse.numero_piece_caisse}
                        onChange={e => setFormCaisse({...formCaisse, numero_piece_caisse: e.target.value})}
                        className="w-full bg-slate-900 border border-cyan-700 p-2 rounded text-xs text-white font-mono"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">
                          N° Chèque / Réf Virement *
                        </label>
                        <input
                          required
                          placeholder="Référence de la transaction"
                          value={formCaisse.reference_bancaire}
                          onChange={e => setFormCaisse({...formCaisse, reference_bancaire: e.target.value})}
                          className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">
                          Banque Émettrice
                        </label>
                        <input
                          placeholder="BNA, BEA, BADR, CPA, etc."
                          value={formCaisse.banque_emetteur}
                          onChange={e => setFormCaisse({...formCaisse, banque_emetteur: e.target.value})}
                          className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 py-2.5 rounded-xl text-xs text-white shadow-xl flex items-center gap-2"
                  >
                    ✓ Comptabiliser le Versement & Clôturer la Facture
                  </button>
                </div>
              </form>
            )}

            {/* GRAND LIVRE INDIVIDUEL : FACTURES ACCUMULÉES */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Passif et Factures Accumulées ({facturesUsager.length})
                </h3>
                <span className="text-[11px] text-slate-400">Cliquez sur "Encaisser" pour enregistrer un versement</span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">N° Facture</th>
                      <th className="p-3">Période (TRM)</th>
                      <th className="p-3">Date Facture</th>
                      <th className="p-3">Montant Émis</th>
                      <th className="p-3">Versements Encaissés</th>
                      <th className="p-3">Reste à Payer</th>
                      <th className="p-3">Statut Comptable</th>
                      <th className="p-3 text-right">Action Guichet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {facturesUsager.map(f => (
                      <tr key={f.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3 font-mono font-bold text-white">{f.numero_facture}</td>
                        <td className="p-3 font-semibold text-slate-300">{f.periode_trimestre} {f.annee}</td>
                        <td className="p-3 text-slate-400">{new Date(f.date_facturation).toLocaleDateString('fr-FR')}</td>
                        <td className="p-3 font-mono">{parseFloat(f.montant_facture).toLocaleString('fr-FR')} DZD</td>
                        <td className="p-3 font-mono text-emerald-400">{parseFloat(f.montant_encaisse).toLocaleString('fr-FR')} DZD</td>
                        <td className="p-3 font-mono font-bold text-red-400">{parseFloat(f.solde_restant).toLocaleString('fr-FR')} DZD</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${f.statut_paiement === 'a_jour' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-red-950 text-red-400 border-red-800'}`}>
                            {f.statut_paiement === 'a_jour' ? 'SOLDÉE' : 'NON RÉGLÉE'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          {f.statut_paiement !== 'a_jour' && canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOuvrirEncaissement(f)}
                              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-3 py-1 rounded-lg text-xs text-white shadow"
                            >
                              💵 Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {facturesUsager.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-500">
                          Aucune facture émise pour cet usager.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* HISTORIQUE DES RÈGLEMENTS DE L'USAGER (TRAÇABILITÉ CAISSE) */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Historique des Encaissements & Pièces de Caisse ({reglementsUsager.length})
              </h3>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">N° Reçu / Quittance</th>
                      <th className="p-2.5">Date Versement</th>
                      <th className="p-2.5">Mode de Paiement</th>
                      <th className="p-2.5">Réf / Pièce de Caisse</th>
                      <th className="p-2.5">Montant Versé</th>
                      <th className="p-2.5 text-right">Agent Encaisseur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {reglementsUsager.map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/30">
                        <td className="p-2.5 font-mono font-bold text-white">{r.numero_recu}</td>
                        <td className="p-2.5 text-slate-400">{new Date(r.date_reglement || r.created_at).toLocaleDateString('fr-FR')}</td>
                        <td className="p-2.5 uppercase text-cyan-300 font-semibold">{r.mode_reglement}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.reference_paiement || '-'}</td>
                        <td className="p-2.5 font-mono font-bold text-emerald-400">{parseFloat(r.montant_verse).toLocaleString('fr-FR')} DZD</td>
                        <td className="p-2.5 text-right text-slate-400">{r.agent_encaisseur || 'Caissier SGPP'}</td>
                      </tr>
                    ))}
                    {reglementsUsager.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-500">
                          Aucun versement n'a encore été comptabilisé pour cet usager.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
