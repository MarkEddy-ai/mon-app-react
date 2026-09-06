import React, { useState, useMemo } from 'react';

export default function Module4Analyses({
  facturesList = [],
  clientsList = [],
  mutationsList = [],
  activePort = 'Bouharoun',
  currentYear = new Date().getFullYear(),
  totalEmisGlobal = 0,
  totalEncaisseDynamique = 0,
  creanceRestanteGlobale = 0,
  tauxRecouvrementTrimestre = '0.0'
}) {
  const [activeSubTab, setActiveSubTab] = useState('synthese'); // 'synthese' | 'debiteurs' | 'audit' | 'mensuel'

  // 1. Performance Trimestrielle Consolidée (TRM 1 à TRM 4)
  const statsTrimestrielles = useMemo(() => {
    return ['1 trm', '2 trm', '3 trm', '4 trm'].map((trm, idx) => {
      const fTrm = facturesList.filter(f => f.periode_trimestre?.toLowerCase().includes(`${idx + 1}`) && f.annee === currentYear);
      const emis = fTrm.reduce((a, b) => a + (parseFloat(b.montant_facture) || 0), 0);
      const recu = fTrm.reduce((a, b) => a + (parseFloat(b.montant_encaisse) || 0), 0);
      const reste = emis - recu;
      const taux = emis > 0 ? ((recu / emis) * 100).toFixed(1) : '0.0';
      return { trm: `TRM ${idx + 1}`, count: fTrm.length, emis, recu, reste, taux };
    });
  }, [facturesList, currentYear]);

  // 2. Chiffre d'Affaires & Encaissements Mensuels (12 Mois)
  const statsMensuelles = useMemo(() => {
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return moisNoms.map((nom, idx) => {
      const fMois = facturesList.filter(f => {
        if (!f.date_facturation) return false;
        const d = new Date(f.date_facturation);
        return d.getMonth() === idx && d.getFullYear() === currentYear;
      });
      const emis = fMois.reduce((a, b) => a + (parseFloat(b.montant_facture) || 0), 0);
      const recu = fMois.reduce((a, b) => a + (parseFloat(b.montant_encaisse) || 0), 0);
      return { mois: nom, count: fMois.length, emis, recu, solde: emis - recu };
    });
  }, [facturesList, currentYear]);

  // 3. Balance Âgée & Débiteurs Prioritaires (Usagers avec impayés)
  const dossiersDebiteurs = useMemo(() => {
    const mapDeb = {};
    facturesList.filter(f => f.statut_paiement !== 'a_jour' && (parseFloat(f.solde_restant) > 0)).forEach(f => {
      if (!mapDeb[f.code_client]) {
        const clientObj = clientsList.find(c => c.code_client === f.code_client);
        const emb = clientObj?.embarcations?.[0];
        mapDeb[f.code_client] = {
          code_client: f.code_client,
          nom_proprietaire: clientObj ? clientObj.nom_proprietaire : 'Inconnu',
          telephone: clientObj?.telephone || '-',
          activite: emb?.nom_embarcation ? `${emb.nom_embarcation} (${emb.immatriculation})` : (clientObj?.type_occupation || 'Terre-plein/Local'),
          nbImpayes: 0,
          soldeTotal: 0,
          facturesRef: []
        };
      }
      mapDeb[f.code_client].nbImpayes += 1;
      mapDeb[f.code_client].soldeTotal += parseFloat(f.solde_restant) || 0;
      mapDeb[f.code_client].facturesRef.push(f.numero_facture);
    });
    return Object.values(mapDeb).sort((a, b) => b.soldeTotal - a.soldeTotal);
  }, [facturesList, clientsList]);

  // 4. Audit des Événements : Résiliations, Sorties, Changements de Nom/Navire
  const auditEvenements = useMemo(() => {
    const list = [];

    // Clients radiés ou ayant résilié
    clientsList.filter(c => c.statut_client === 'radie' || c.statut_client === 'resilie' || c.statut_client === 'contentieux').forEach(c => {
      list.push({
        id: `rad-${c.id}`,
        type: c.statut_client === 'radie' ? 'Sortie du Domaine / Radiation' : 'Résiliation Contrat',
        date: c.updated_at ? new Date(c.updated_at).toLocaleDateString('fr-FR') : 'Signalé',
        acteur: `${c.nom_proprietaire} (${c.code_client})`,
        detail: `Dossier clôturé. Activité : ${c.embarcations?.[0]?.nom_embarcation || 'Local/Terre-plein'}`,
        badgeClass: 'bg-red-950 text-red-300 border-red-800'
      });
    });

    // Mutations enregistrées
    mutationsList.forEach(m => {
      list.push({
        id: `mut-${m.id}`,
        type: m.type_mutation || 'Mutation / Transfert',
        date: m.date_evenement ? new Date(m.date_evenement).toLocaleDateString('fr-FR') : '-',
        acteur: m.matricule_navire || m.code_client || 'Navire / Local',
        detail: m.motif_acte || `Mutation de propriété / Changement d'exploitant`,
        badgeClass: 'bg-amber-950 text-amber-300 border-amber-800'
      });
    });

    return list;
  }, [clientsList, mutationsList]);

  // --- Exportations & Impression ---
  const handleExportGrandLivre = () => {
    if (facturesList.length === 0) return alert('Aucune facture enregistrée.');
    const headers = ['N° Facture', 'Code Client', 'Port', 'Trimestre', 'Année', 'Date Facturation', 'Montant Émis (DZD)', 'Encaissé (DZD)', 'Solde Restant (DZD)', 'Statut'];
    const rows = facturesList.map(f => [
      f.numero_facture, f.code_client, f.port, f.periode_trimestre, f.annee, f.date_facturation,
      f.montant_facture, f.montant_encaisse, f.solde_restant, f.statut_paiement
    ]);
    const link = document.createElement('a');
    link.href = encodeURI("data:text/csv;charset=utf-8," + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n'));
    link.download = `Grand_Livre_Recouvrement_${activePort}_${currentYear}.csv`;
    link.click();
  };

  const handleExportDebiteurs = () => {
    if (dossiersDebiteurs.length === 0) return alert('Aucun dossier débiteur en souffrance.');
    const headers = ['Code Client', 'Nom Propriétaire', 'Téléphone', 'Activité / Bien', 'Factures Impayées', 'Créance Totale Dûe (DZD)'];
    const rows = dossiersDebiteurs.map(d => [d.code_client, d.nom_proprietaire, d.telephone, d.activite, d.nbImpayes, d.soldeTotal]);
    const link = document.createElement('a');
    link.href = encodeURI("data:text/csv;charset=utf-8," + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n'));
    link.download = `Etat_Debiteurs_Contentieux_${activePort}_${currentYear}.csv`;
    link.click();
  };

  const handlePrintRapportDirection = () => {
    const w = window.open('', '', 'width=1000,height=750');
    w.document.write(`
      <html>
        <head>
          <title>Rapport Directionnel - SGPP Tipaza</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 35px; color: #111; font-size: 13px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 25px; }
            h2, h3 { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px; }
            th, td { border: 1px solid #444; padding: 7px 10px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .right { text-align: right; font-family: monospace; }
            .kpis { display: flex; justify-content: space-between; border: 1px solid #000; padding: 12px; margin-bottom: 25px; background: #fafafa; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>ENTREPRISE DE GESTION DES PORTS DE PÊCHE (SGPP)</h2>
            <h3>UNITÉ DE GESTION DES PORTS DE TIPAZA — PORT DE ${activePort.toUpperCase()}</h3>
            <p><strong>RAPPORT DÉCISIONNEL DE RECOUVREMENT & D'AUDIT COMPTABLE</strong></p>
            <p>Date d'édition : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          </div>

          <div class="kpis">
            <div><strong>CA Facturé Cumulé :</strong> ${totalEmisGlobal.toLocaleString('fr-FR')} DZD</div>
            <div><strong>Encaissement Réalisé :</strong> ${totalEncaisseDynamique.toLocaleString('fr-FR')} DZD</div>
            <div><strong>Créances en Souffrance :</strong> ${creanceRestanteGlobale.toLocaleString('fr-FR')} DZD</div>
            <div><strong>Taux Recouvrement Global :</strong> ${totalEmisGlobal > 0 ? ((totalEncaisseDynamique / totalEmisGlobal) * 100).toFixed(1) : 0} %</div>
          </div>

          <h4>1. Synthèse Trimestrielle de l'Exercice (${currentYear})</h4>
          <table>
            <tr><th>Période</th><th>Factures</th><th>Montant Facturé</th><th>Montant Encaissé</th><th>Reste Dû</th><th>Taux</th></tr>
            ${statsTrimestrielles.map(s => `
              <tr>
                <td><strong>${s.trm}</strong></td>
                <td>${s.count}</td>
                <td class="right">${s.emis.toLocaleString('fr-FR')} DZD</td>
                <td class="right">${s.recu.toLocaleString('fr-FR')} DZD</td>
                <td class="right">${s.reste.toLocaleString('fr-FR')} DZD</td>
                <td class="right"><strong>${s.taux} %</strong></td>
              </tr>
            `).join('')}
          </table>

          <h4>2. Dossiers Débiteurs Critiques & En Retard (${dossiersDebiteurs.length})</h4>
          <table>
            <tr><th>Code</th><th>Propriétaire</th><th>Activité / Navire</th><th>Factures Dues</th><th>Créance Totale</th></tr>
            ${dossiersDebiteurs.slice(0, 15).map(d => `
              <tr>
                <td><strong>${d.code_client}</strong></td>
                <td>${d.nom_proprietaire}</td>
                <td>${d.activite}</td>
                <td>${d.nbImpayes} impayée(s)</td>
                <td class="right"><strong>${d.soldeTotal.toLocaleString('fr-FR')} DZD</strong></td>
              </tr>
            `).join('')}
            ${dossiersDebiteurs.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Aucune créance débiteur. Port 100% à jour.</td></tr>' : ''}
          </table>

          <div class="footer">
            <div>Le Chef de Service Portuaire</div>
            <div>Visa Direction Unité de Tipaza</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="space-y-6">

      {/* BANDEAU SUPÉRIEUR DIRECTION : TITRE & BOUTONS D'EXTRACTION OFFICIELS */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-black text-white tracking-wide">
              Cockpit Décisionnel de la Direction — Port de {activePort}
            </h2>
            <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
              Consolidation Finale
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Résultat final de la chaîne opératoire : contrôle comptable, balance âgée, audit des mutations et sorties du domaine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handlePrintRapportDirection}
            className="bg-cyan-600 hover:bg-cyan-500 font-bold px-4 py-2.5 rounded-xl text-xs text-white flex items-center gap-2 shadow-lg transition"
          >
            🖨 Imprimer Bilan Direction (PDF / A4)
          </button>
          <button
            onClick={handleExportGrandLivre}
            className="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 py-2.5 rounded-xl text-xs text-white flex items-center gap-2 shadow-lg transition"
          >
            📊 Grand Livre (.CSV Excel)
          </button>
          <button
            onClick={handleExportDebiteurs}
            className="bg-red-950 hover:bg-red-900 border border-red-800 font-bold px-4 py-2.5 rounded-xl text-xs text-red-300 flex items-center gap-2 shadow-lg transition"
          >
            ⚠️ Dossiers Débiteurs (.CSV)
          </button>
        </div>
      </div>

      {/* 4 GRANDES CARTES DE RENDU DÉCISIONNEL */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
          <span className="text-xs text-slate-400 block font-medium">Chiffre d'Affaires Global Émis</span>
          <p className="text-2xl font-black text-white mt-1">
            {totalEmisGlobal.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Toutes factures physiques saisies</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
          <span className="text-xs text-slate-400 block font-medium">Total Encaissé Perçu</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {totalEncaisseDynamique.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Recouvrement constaté en caisse</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
          <span className="text-xs text-slate-400 block font-medium">Créances en Souffrance</span>
          <p className="text-2xl font-black text-red-400 mt-1">
            {creanceRestanteGlobale.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">DZD</span>
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Solde total débiteur à recouvrer</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow">
          <span className="text-xs text-slate-400 block font-medium">Taux d'Efficacité Recouvrement</span>
          <p className="text-2xl font-black text-cyan-400 mt-1">
            {totalEmisGlobal > 0 ? ((totalEncaisseDynamique / totalEmisGlobal) * 100).toFixed(1) : '0.0'} %
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">Performance globale du port</span>
        </div>
      </div>

      {/* SÉLECTEUR DE VUES D'ANALYSE DÉCISIONNELLE */}
      <div className="bg-slate-900/80 border border-slate-800 p-1.5 rounded-xl flex flex-wrap gap-2">
        {[
          { id: 'synthese', label: '1. Analyse Trimestrielle (TRM 1 - 4)' },
          { id: 'mensuel', label: "2. Chiffre d'Affaires Mensuel (12 Mois)" },
          { id: 'debiteurs', label: `3. Balance Âgée & Débiteurs (${dossiersDebiteurs.length})` },
          { id: 'audit', label: `4. Registre des Mutations & Sorties (${auditEvenements.length})` }
        ].map(st => (
          <button
            key={st.id}
            onClick={() => setActiveSubTab(st.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${activeSubTab === st.id ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* SECTION 1 : VUE TRIMESTRIELLE */}
      {activeSubTab === 'synthese' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Ventilation du Chiffre d'Affaires & Encaissements par Trimestre ({currentYear})
            </h3>
            <span className="text-[11px] text-slate-400">Port de {activePort}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3.5">Trimestre</th>
                  <th className="p-3.5">Volume Factures</th>
                  <th className="p-3.5">Chiffre d'Affaires Émis</th>
                  <th className="p-3.5">Montant Encaissé</th>
                  <th className="p-3.5">Créances Restantes</th>
                  <th className="p-3.5 text-right">Taux de Recouvrement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {statsTrimestrielles.map(s => (
                  <tr key={s.trm} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-bold text-white text-sm">{s.trm}</td>
                    <td className="p-3.5 font-mono text-slate-300">{s.count} facture(s)</td>
                    <td className="p-3.5 font-mono font-bold text-white">{s.emis.toLocaleString('fr-FR')} DZD</td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">{s.recu.toLocaleString('fr-FR')} DZD</td>
                    <td className="p-3.5 font-mono text-red-400 font-bold">{s.reste.toLocaleString('fr-FR')} DZD</td>
                    <td className="p-3.5 text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${parseFloat(s.taux) >= 80 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                        {s.taux} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2 : VUE MENSUELLE */}
      {activeSubTab === 'mensuel' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Chiffre d'Affaires Mensuel et Flux d'Encaissements ({currentYear})
            </h3>
            <span className="text-[11px] text-slate-400">12 Mois d'Exercice</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3">Mois</th>
                  <th className="p-3">Factures Saisies</th>
                  <th className="p-3">Montant Facturé</th>
                  <th className="p-3">Montant Encaissé</th>
                  <th className="p-3 text-right">Solde Restant Dû</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {statsMensuelles.map(m => (
                  <tr key={m.mois} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{m.mois}</td>
                    <td className="p-3 font-mono text-slate-300">{m.count}</td>
                    <td className="p-3 font-mono">{m.emis.toLocaleString('fr-FR')} DZD</td>
                    <td className="p-3 font-mono text-emerald-400">{m.recu.toLocaleString('fr-FR')} DZD</td>
                    <td className="p-3 font-mono font-bold text-red-400 text-right">{m.solde.toLocaleString('fr-FR')} DZD</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3 : BALANCE ÂGÉE & DÉBITEURS */}
      {activeSubTab === 'debiteurs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
                État Nominatif des Débiteurs en Souffrance ({dossiersDebiteurs.length})
              </h3>
              <p className="text-[11px] text-slate-500">Classé par niveau de risque financier</p>
            </div>
            <button
              onClick={handleExportDebiteurs}
              className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              📥 Exporter Liste Débiteurs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3">Code Usager</th>
                  <th className="p-3">Nom Armateur / Exploitant</th>
                  <th className="p-3">Activité / Embarcation</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Factures Non Réglées</th>
                  <th className="p-3 text-right">Créance Totale Impayée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dossiersDebiteurs.map(d => (
                  <tr key={d.code_client} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-300">{d.code_client}</td>
                    <td className="p-3 font-bold text-white">{d.nom_proprietaire}</td>
                    <td className="p-3 text-slate-300">{d.activite}</td>
                    <td className="p-3 text-slate-400">{d.telephone}</td>
                    <td className="p-3 font-mono text-amber-400 font-bold">{d.nbImpayes} impayée(s)</td>
                    <td className="p-3 font-mono font-black text-red-400 text-right text-sm">
                      {d.soldeTotal.toLocaleString('fr-FR')} DZD
                    </td>
                  </tr>
                ))}
                {dossiersDebiteurs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-emerald-400 font-bold">
                      ✓ Aucun usager débiteur constaté. La totalité des factures émises est réglée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 4 : REGISTRE D'AUDIT, MUTATIONS & SORTIES */}
      {activeSubTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Journal d'Audit : Mutations, Sorties du Système & Résiliations
              </h3>
              <p className="text-[11px] text-slate-500">Traçabilité administrative des changements survenus au port</p>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded font-mono">
              Contrôle de Gestion
            </span>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {auditEvenements.map(e => (
              <div key={e.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{e.acteur}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${e.badgeClass}`}>
                      {e.type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{e.detail}</p>
                </div>
                <span className="text-xs text-slate-500 font-mono">{e.date}</span>
              </div>
            ))}

            {auditEvenements.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs">
                Aucune radiation de navire, résiliation de contrat ou mutation de propriétaire signalée pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
