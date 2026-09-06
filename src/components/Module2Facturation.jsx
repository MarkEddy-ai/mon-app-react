import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';

const TYPES_OCCUPATION = [
  { id: 'embarcation', label: "Embarcation (Plan d'eau)" },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'case_commerciale', label: 'Case Commerciale' },
  { id: 'case_pecheur', label: 'Case Pêcheur' },
  { id: 'terre_plein', label: 'Terre-plein' },
  { id: 'autre', label: 'Autre prestation' }
];
const TYPES_FLOTTE = ['sardiniers', 'chalutiers', 'petit metiers', 'plaisance', 'thoniers'];
const TRIMESTRES = ['TRM 1', 'TRM 2', 'TRM 3', 'TRM 4'];

export default function Module2Facturation({ clientsList, facturesList, activePort, canEdit, reloadData }) {
  const [selectedFactureId, setSelectedFactureId] = useState(null);
  const [searchFactureClient, setSearchFactureClient] = useState('');

  const initialFactureForm = {
    numero_facture: '',
    code_client: '',
    nom_proprietaire: '',
    nature_activite: "Embarcation (Plan d'eau)",
    nom_embarcation: '',
    immatriculation: '',
    type_embarcation: 'sardiniers',
    surface: '0.00',
    periode_trimestre: 'TRM 3',
    annee: new Date().getFullYear(),
    date_facturation: new Date().toISOString().slice(0, 10),
    montant_facture: ''
  };
  const [factureForm, setFactureForm] = useState(initialFactureForm);

  const suggestionsClientsM1 = useMemo(() => {
    const q = searchFactureClient.toLowerCase().trim();
    if (!q) return [];
    return clientsList.filter(c =>
      c.code_client?.toLowerCase().includes(q) ||
      c.nom_proprietaire?.toLowerCase().includes(q) ||
      c.nom_prenom?.toLowerCase().includes(q) ||
      c.embarcations?.some(e => e.nom_embarcation?.toLowerCase().includes(q) || e.immatriculation?.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [clientsList, searchFactureClient]);

  const handleSelectClient = (c) => {
    const emb = c.embarcations?.[0] || {};
    setFactureForm(prev => ({
      ...prev,
      code_client: c.code_client || '',
      nom_proprietaire: c.nom_proprietaire || '',
      nature_activite: emb.type_embarcation ? "Embarcation (Plan d'eau)" : "Terre-plein / Local",
      nom_embarcation: emb.nom_embarcation || 'N/A',
      immatriculation: emb.immatriculation || 'N/A',
      type_embarcation: emb.type_embarcation || 'sardiniers',
      surface: emb.surface ? parseFloat(emb.surface).toFixed(2) : '0.00'
    }));
    setSearchFactureClient('');
  };

  const handleLoadFactureToEdit = (f) => {
    setSelectedFactureId(f.id);
    const client = clientsList.find(c => c.code_client === f.code_client);
    const emb = client?.embarcations?.[0] || {};
    setFactureForm({
      numero_facture: f.numero_facture,
      code_client: f.code_client,
      nom_proprietaire: client ? client.nom_proprietaire : 'N/A',
      nature_activite: emb.type_embarcation ? "Embarcation (Plan d'eau)" : "Terre-plein / Local",
      nom_embarcation: emb.nom_embarcation || 'N/A',
      immatriculation: emb.immatriculation || 'N/A',
      type_embarcation: emb.type_embarcation || 'sardiniers',
      surface: emb.surface ? parseFloat(emb.surface).toFixed(2) : '0.00',
      periode_trimestre: f.periode_trimestre ? `TRM ${f.periode_trimestre.replace(' trm', '')}` : 'TRM 3',
      annee: f.annee || new Date().getFullYear(),
      date_facturation: f.date_facturation,
      montant_facture: f.montant_facture
    });
  };

  const handleResetFactureForm = () => {
    setSelectedFactureId(null);
    setFactureForm(initialFactureForm);
    setSearchFactureClient('');
  };

  const handleSaveOrUpdateFacture = async (e) => {
    e.preventDefault();
    if (!canEdit) return alert('Action refusée : Mode Consultation.');
    if (!factureForm.numero_facture || !factureForm.code_client || !factureForm.montant_facture) {
      return alert('N° Facture, Code Client et Montant sont obligatoires.');
    }

    const payload = {
      numero_facture: factureForm.numero_facture,
      code_client: factureForm.code_client,
      immatriculation: factureForm.immatriculation !== 'N/A' ? factureForm.immatriculation : null,
      port: activePort,
      periode_trimestre: factureForm.periode_trimestre.replace('TRM ', '') + ' trm',
      annee: parseInt(factureForm.annee),
      date_facturation: factureForm.date_facturation,
      montant_facture: parseFloat(factureForm.montant_facture) || 0
    };

    if (selectedFactureId) {
      const { error } = await supabase.from('factures').update(payload).eq('id', selectedFactureId);
      if (error) alert('Erreur modification : ' + error.message);
      else {
        alert('Facture mise à jour.');
        handleResetFactureForm();
        reloadData();
      }
    } else {
      const { error } = await supabase.from('factures').insert([payload]);
      if (error) alert('Erreur création : ' + error.message);
      else {
        alert('Nouvelle facture enregistrée.');
        handleResetFactureForm();
        reloadData();
      }
    }
  };

  const handleDeleteFacture = async () => {
    if (!selectedFactureId) return alert('Sélectionnez d’abord une facture.');
    if (!window.confirm('Confirmez-vous la suppression ?')) return;
    const { error } = await supabase.from('factures').delete().eq('id', selectedFactureId);
    if (error) alert('Erreur : ' + error.message);
    else {
      alert('Facture supprimée.');
      handleResetFactureForm();
      reloadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-cyan-400">
              {selectedFactureId ? '✏️ Modifier / Ajuster la Facture Sélectionnée' : '📝 Saisie & Émission des Factures Trimestrielles'}
            </h2>
            <p className="text-xs text-slate-400">
              Liaison directe avec le répertoire Usagers & Occupations : tapez un code ou nom pour pré-remplir la fiche.
            </p>
          </div>

          <div className="relative w-full sm:w-96">
            <input
              type="text"
              placeholder="🔍 Taper code client, nom armateur, navire ou immat..."
              value={searchFactureClient}
              onChange={e => setSearchFactureClient(e.target.value)}
              className="w-full bg-slate-950 border border-cyan-700/80 rounded-lg px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-400 outline-none"
            />
            {suggestionsClientsM1.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-30 divide-y divide-slate-800">
                {suggestionsClientsM1.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClient(c)}
                    className="p-2.5 text-xs hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                  >
                    <span className="font-bold text-cyan-300">[{c.code_client}] {c.nom_proprietaire}</span>
                    <span className="text-[11px] text-slate-400">{c.embarcations?.[0]?.nom_embarcation || c.embarcations?.[0]?.immatriculation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveOrUpdateFacture} className="space-y-5">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">1. Renseignements Usager & Nature d'Occupation (Module 1)</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Code Client *</label>
                <input required placeholder="ex: CLT-001" value={factureForm.code_client} onChange={e => setFactureForm({...factureForm, code_client: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-white font-mono font-bold" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Nom Propriétaire *</label>
                <input required placeholder="Nom armateur" value={factureForm.nom_proprietaire} onChange={e => setFactureForm({...factureForm, nom_proprietaire: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-white font-bold" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Nature d'Activité / Occupation</label>
                <select value={factureForm.nature_activite} onChange={e => setFactureForm({...factureForm, nature_activite: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-cyan-300 font-semibold">
                  {TYPES_OCCUPATION.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Nom Embarcation / Local</label>
                <input placeholder="Nom navire" value={factureForm.nom_embarcation} onChange={e => setFactureForm({...factureForm, nom_embarcation: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-white" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-900">
              <div>
                <label className="text-[11px] text-slate-400">Immatriculation</label>
                <input placeholder="ex: AL-2544" value={factureForm.immatriculation} onChange={e => setFactureForm({...factureForm, immatriculation: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-white font-mono" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Type de Flotte</label>
                <select value={factureForm.type_embarcation} onChange={e => setFactureForm({...factureForm, type_embarcation: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-white">
                  {TYPES_FLOTTE.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Surface d'Occupation (m²)</label>
                <input type="number" step="0.01" placeholder="ex: 35.5" value={factureForm.surface} onChange={e => setFactureForm({...factureForm, surface: e.target.value})} className="w-full mt-1 bg-slate-900 p-2 rounded border border-slate-700 text-xs text-cyan-400 font-mono font-bold" />
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">2. Renseignements Facture Physique</span>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400">N° Facture *</label>
                <input required placeholder="ex: FAC-2026-001" value={factureForm.numero_facture} onChange={e => setFactureForm({...factureForm, numero_facture: e.target.value})} className="w-full mt-1 bg-slate-900 p-2.5 rounded border border-slate-700 text-xs text-white font-mono font-bold" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Période Trimestrielle (TRM) *</label>
                <select value={factureForm.periode_trimestre} onChange={e => setFactureForm({...factureForm, periode_trimestre: e.target.value})} className="w-full mt-1 bg-slate-900 p-2.5 rounded border border-slate-700 text-xs text-white font-bold">
                  {TRIMESTRES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Date Facture *</label>
                <input type="date" required value={factureForm.date_facturation} onChange={e => setFactureForm({...factureForm, date_facturation: e.target.value})} className="w-full mt-1 bg-slate-900 p-2.5 rounded border border-slate-700 text-xs text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Montant (DZD) *</label>
                <input type="number" step="0.01" required placeholder="ex: 45000" value={factureForm.montant_facture} onChange={e => setFactureForm({...factureForm, montant_facture: e.target.value})} className="w-full mt-1 bg-slate-900 p-2.5 rounded border border-cyan-600 text-xs text-cyan-300 font-mono font-bold text-sm" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-lg text-xs text-white shadow-lg flex items-center gap-2">
              {selectedFactureId ? '💾 Enregistrer Modification' : '➕ Valider et Émettre la Facture'}
            </button>
            {selectedFactureId && (
              <button type="button" onClick={handleDeleteFacture} className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold px-4 py-2.5 rounded-lg text-xs">
                🗑 Supprimer Facture
              </button>
            )}
            <button type="button" onClick={handleResetFactureForm} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-lg text-xs border border-slate-700">
              🔄 Réinitialiser
            </button>
          </div>
        </form>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-300">Dernières Factures Émises ({facturesList.length} enregistrées à {activePort})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3">N° Facture</th>
                <th className="p-3">Code Client</th>
                <th className="p-3">Période</th>
                <th className="p-3">Date</th>
                <th className="p-3">Montant Émis</th>
                <th className="p-3">Encaissé</th>
                <th className="p-3">Solde Dû</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {facturesList.slice(0, 10).map(f => (
                <tr key={f.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-white">{f.numero_facture}</td>
                  <td className="p-3 font-semibold text-cyan-300">{f.code_client}</td>
                  <td className="p-3">{f.periode_trimestre} {f.annee}</td>
                  <td className="p-3 text-slate-400">{new Date(f.date_facturation).toLocaleDateString('fr-FR')}</td>
                  <td className="p-3 font-mono">{parseFloat(f.montant_facture).toLocaleString('fr-FR')} DZD</td>
                  <td className="p-3 font-mono text-emerald-400">{parseFloat(f.montant_encaisse).toLocaleString('fr-FR')} DZD</td>
                  <td className="p-3 font-mono font-bold text-red-400">{parseFloat(f.solde_restant).toLocaleString('fr-FR')} DZD</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.statut_paiement === 'a_jour' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                      {f.statut_paiement === 'a_jour' ? 'SOLDÉ' : 'NON PAYÉ'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => handleLoadFactureToEdit(f)} className="bg-slate-800 hover:bg-slate-700 text-cyan-300 px-2.5 py-1 rounded text-xs border border-slate-700">Charger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
