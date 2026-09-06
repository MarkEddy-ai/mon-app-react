import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';

// Familles domaniales et nomenclatures des activités portuaires
const FAMILLES = [
  {
    id: 'plan_deau',
    label: "Plan d'Eau (Flotte & Navires)",
    types: [
      { id: 'sardiniers', label: 'Sardinier' },
      { id: 'chalutiers', label: 'Chalutier' },
      { id: 'petit metiers', label: 'Petit Métier' },
      { id: 'thoniers', label: 'Thonier' },
      { id: 'plaisance', label: 'Plaisance' },
      { id: 'servitude', label: 'Servitude Portuaire' }
    ]
  },
  {
    id: 'infrastructures_peche',
    label: 'Infrastructures Pêche & Stockage',
    types: [
      { id: 'case_pecheur', label: 'Case Pêcheur' },
      { id: 'fabrique_glace', label: 'Fabrique de Glace' },
      { id: 'entrepot_frigo', label: 'Entrepôt Frigorifique' },
      { id: 'hangar_stockage', label: 'Hangar de Stockage' },
      { id: 'surface_ramendage', label: 'Surface de Ramendage' }
    ]
  },
  {
    id: 'commerces',
    label: 'Concessions Commerciales & Services',
    types: [
      { id: 'restaurant', label: 'Restaurant' },
      { id: 'cafeteria', label: 'Cafétéria' },
      { id: 'case_commerciale', label: 'Case Commerciale' },
      { id: 'station_carburant', label: "Station d'Avitaillement" }
    ]
  },
  {
    id: 'services_techniques',
    label: 'Chantiers & Maintenance Navale',
    types: [
      { id: 'cale_halage', label: 'Cale de Halage' },
      { id: 'aire_carenage', label: 'Surface de Carénage' },
      { id: 'mecanique_navale', label: 'Atelier Mécanique Navale' },
      { id: 'electricite_navale', label: 'Atelier Électricité Navale' },
      { id: 'soudure_marine', label: 'Atelier Soudure Marine' }
    ]
  }
];

// Nomenclatures des actes juridiques
const TYPES_ACTES = [
  { id: 'amarrage', label: "Contrat d'Amarrage" },
  { id: 'amodiation', label: "Contrat d'Amodiation" },
  { id: 'convention', label: "Convention d'Exploitation" },
  { id: 'aot', label: "Autorisation d'Occupation Temporaire (AOT)" }
];

const LISTE_PORTS = ['Bouharoun', 'Tipaza', 'Khemisti', 'Cherchell', 'Gouraya'];

const QUARTIERS_MARITIMES = [
  { prefix: '', label: 'Toutes les immatriculations' },
  { prefix: 'AL', label: 'AL — Alger' },
  { prefix: 'CH', label: 'CH — Cherchell' },
  { prefix: 'BOU', label: 'BOU — Bouharoun' },
  { prefix: 'TIP', label: 'TIP — Tipaza' },
  { prefix: 'MG', label: 'MG — Mostaganem' },
  { prefix: 'OR', label: 'OR — Oran' },
  { prefix: 'DZ', label: 'DZ — Immat Nationale' },
  { prefix: 'HORS_PORT', label: '⚠️ Tous les navires Hors Port (Hors code local)' }
];

const normaliserPort = (nom) => {
  if (!nom) return '';
  const clean = nom.trim().toLowerCase();
  if (clean === 'tipasa' || clean === 'tipaza') return 'tipaza';
  return clean;
};

export default function Module1Usagers({
  clientsList = [],
  activePort = 'Bouharoun',
  canEdit = false,
  reloadData = () => {}
}) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [filtreRecherche, setFiltreRecherche] = useState('');
  const [periodeRegistre, setPeriodeRegistre] = useState('global');
  const [enCoursEnregistrement, setEnCoursEnregistrement] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Notifications in-app intégrées (remplace alert/confirm)
  const [notification, setNotification] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Filtres avancés du Chef de Port
  const [afficherFiltresAvances, setAfficherFiltresAvances] = useState(false);
  const [filtreTypeActivite, setFiltreTypeActivite] = useState('');
  const [filtreQuartierImmat, setFiltreQuartierImmat] = useState('');
  const [filtreSaisieImmat, setFiltreSaisieImmat] = useState('');
  const [filtreLongueurExacte, setFiltreLongueurExacte] = useState('');
  const [filtreLongueurOperateur, setFiltreLongueurOperateur] = useState('exact');
  const [filtreDateDebut, setFiltreDateDebut] = useState('');
  const [filtreDateFin, setFiltreDateFin] = useState('');
  const [filtreSituationPres, setFiltreSituationPres] = useState('');
  const [questionPredefinie, setQuestionPredefinie] = useState('');

  const formInitial = {
    code_client: '',
    nom_prenom: '',
    nin: '',
    telephone: '',
    adresse: '',
    nature_date: 'recensement',
    date_evenement: new Date().toISOString().split('T')[0],
    type_contrat: 'amarrage',
    numero_acte: '',
    statut_client: 'actif',
    famille_activite: 'plan_deau',
    type_activite: 'sardiniers',
    nom_embarcation: '',
    immatriculation: '',
    longueur: '',
    largeur: '',
    designation_bien: '',
    surface_fixe: '',
    port_recensement: activePort,
    registre_commerce: ''
  };

  const [form, setForm] = useState(formInitial);

  const surfaceAffichee = useMemo(() => {
    if (form.famille_activite === 'plan_deau') {
      const l = parseFloat(form.longueur) || 0;
      const w = parseFloat(form.largeur) || 0;
      return (l * w).toFixed(2);
    }
    return parseFloat(form.surface_fixe || 0).toFixed(2);
  }, [form.famille_activite, form.longueur, form.largeur, form.surface_fixe]);

  const portNormalise = useMemo(() => normaliserPort(activePort), [activePort]);
  const estDirection = useMemo(() => portNormalise === 'direction', [portNormalise]);

  const clientsDuPort = useMemo(() => {
    if (estDirection) return clientsList;

    return clientsList.filter((c) => {
      const portTrouveDansEmb = c.embarcations?.some((emb) => {
        return normaliserPort(emb.port_attache) === portNormalise;
      });
      const portTrouveDirect = normaliserPort(c.port_attache) === portNormalise;
      return Boolean(portTrouveDansEmb || portTrouveDirect);
    });
  }, [clientsList, portNormalise, estDirection]);

  const nombreFiltresActifs = useMemo(() => {
    let count = 0;
    if (filtreTypeActivite) count++;
    if (filtreQuartierImmat || filtreSaisieImmat) count++;
    if (filtreLongueurExacte) count++;
    if (filtreDateDebut || filtreDateFin) count++;
    if (filtreSituationPres) count++;
    if (filtreRecherche) count++;
    return count;
  }, [
    filtreTypeActivite,
    filtreQuartierImmat,
    filtreSaisieImmat,
    filtreLongueurExacte,
    filtreDateDebut,
    filtreDateFin,
    filtreSituationPres,
    filtreRecherche
  ]);

  const handleAppliquerQuestionPredefinie = (val) => {
    setQuestionPredefinie(val);
    setFiltreTypeActivite('');
    setFiltreQuartierImmat('');
    setFiltreSaisieImmat('');
    setFiltreLongueurExacte('');
    setFiltreLongueurOperateur('exact');
    setFiltreDateDebut('');
    setFiltreDateFin('');
    setFiltreSituationPres('');

    if (!val) return;

    if (val === 'sardiniers') {
      setFiltreTypeActivite('sardiniers');
    } else if (val === 'chalutiers') {
      setFiltreTypeActivite('chalutiers');
    } else if (val === 'petit_metiers') {
      setFiltreTypeActivite('petit metiers');
    } else if (val === 'plaisance') {
      setFiltreTypeActivite('plaisance');
    } else if (val === 'longueur_16m') {
      setFiltreLongueurExacte('16');
      setFiltreLongueurOperateur('exact');
    } else if (val === 'longueur_gte_16m') {
      setFiltreLongueurExacte('16');
      setFiltreLongueurOperateur('gte');
    } else if (val === 'longueur_lte_10m') {
      setFiltreLongueurExacte('10');
      setFiltreLongueurOperateur('lte');
    } else if (val === 'navires_hors_port') {
      setFiltreQuartierImmat('HORS_PORT');
    } else if (val === 'navires_deplaces') {
      setFiltreSituationPres('deplace');
    } else if (val === 'terres_pleins') {
      setFiltreTypeActivite('DOM');
    }
  };

  const handleResetTousFiltres = () => {
    setQuestionPredefinie('');
    setFiltreTypeActivite('');
    setFiltreQuartierImmat('');
    setFiltreSaisieImmat('');
    setFiltreLongueurExacte('');
    setFiltreLongueurOperateur('exact');
    setFiltreDateDebut('');
    setFiltreDateFin('');
    setFiltreSituationPres('');
    setFiltreRecherche('');
  };

  const clientsFiltres = useMemo(() => {
    let list = clientsDuPort;

    // 1. Recherche plein texte
    const q = filtreRecherche.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (c) =>
          c.code_client?.toLowerCase().includes(q) ||
          c.nom_proprietaire?.toLowerCase().includes(q) ||
          c.nom_prenom?.toLowerCase().includes(q) ||
          c.nin?.toLowerCase().includes(q) ||
          c.embarcations?.some(
            (e) =>
              e.nom_embarcation?.toLowerCase().includes(q) ||
              e.immatriculation?.toLowerCase().includes(q)
          )
      );
    }

    // 2. Filtre Activité
    if (filtreTypeActivite) {
      if (filtreTypeActivite === 'DOM') {
        list = list.filter((c) => {
          const emb = c.embarcations?.[0];
          return emb?.immatriculation?.startsWith('DOM-');
        });
      } else {
        list = list.filter((c) => {
          const emb = c.embarcations?.[0];
          return (
            emb?.type_embarcation?.toLowerCase() === filtreTypeActivite.toLowerCase()
          );
        });
      }
    }

    // 3. Filtre Immatriculation & Quartier maritime
    if (filtreQuartierImmat) {
      if (filtreQuartierImmat === 'HORS_PORT') {
        const prefixLocal = activePort.substring(0, 2).toUpperCase();
        list = list.filter((c) => {
          const emb = c.embarcations?.[0];
          const immat = (emb?.immatriculation || '').toUpperCase().trim();
          return (
            immat &&
            !immat.startsWith('DOM-') &&
            !immat.startsWith(prefixLocal)
          );
        });
      } else {
        list = list.filter((c) => {
          const emb = c.embarcations?.[0];
          const immat = (emb?.immatriculation || '').toUpperCase().trim();
          return immat.startsWith(filtreQuartierImmat);
        });
      }
    }

    if (filtreSaisieImmat.trim()) {
      const termImmat = filtreSaisieImmat.toLowerCase().trim();
      list = list.filter((c) => {
        const emb = c.embarcations?.[0];
        return emb?.immatriculation?.toLowerCase().includes(termImmat);
      });
    }

    // 4. Filtre Métrage / Longueur
    if (filtreLongueurExacte) {
      const valL = parseFloat(filtreLongueurExacte);
      if (!isNaN(valL)) {
        list = list.filter((c) => {
          const emb = c.embarcations?.[0];
          const l = parseFloat(emb?.longueur || 0);
          if (filtreLongueurOperateur === 'exact') {
            return Math.abs(l - valL) < 0.1;
          } else if (filtreLongueurOperateur === 'gte') {
            return l >= valL;
          } else if (filtreLongueurOperateur === 'lte') {
            return l > 0 && l <= valL;
          }
          return true;
        });
      }
    }

    // 5. Filtre Période Date
    if (filtreDateDebut) {
      list = list.filter((c) => {
        const emb = c.embarcations?.[0];
        return emb?.date_recensement && emb.date_recensement >= filtreDateDebut;
      });
    }
    if (filtreDateFin) {
      list = list.filter((c) => {
        const emb = c.embarcations?.[0];
        return emb?.date_recensement && emb.date_recensement <= filtreDateFin;
      });
    }

    // 6. Situation de Présence
    if (filtreSituationPres) {
      list = list.filter((c) => {
        const emb = c.embarcations?.[0];
        const portAtt = emb?.port_attache || activePort;
        const portRec = emb?.port_recensement || portAtt;
        const estDeplace = normaliserPort(portRec) !== normaliserPort(portAtt);
        if (filtreSituationPres === 'au_port') return !estDeplace;
        if (filtreSituationPres === 'deplace') return estDeplace;
        return true;
      });
    }

    if (periodeRegistre === 'derniers_5') return list.slice(0, 5);
    return list;
  }, [
    clientsDuPort,
    filtreRecherche,
    filtreTypeActivite,
    filtreQuartierImmat,
    filtreSaisieImmat,
    filtreLongueurExacte,
    filtreLongueurOperateur,
    filtreDateDebut,
    filtreDateFin,
    filtreSituationPres,
    periodeRegistre,
    activePort
  ]);

  const statsResultatsFiltres = useMemo(() => {
    let surfaceCumulee = 0;
    let nbNavires = 0;
    let nbTerrestre = 0;

    clientsFiltres.forEach((c) => {
      const emb = c.embarcations?.[0];
      const s = parseFloat(emb?.surface || (emb?.longueur * emb?.largeur) || 0);
      if (!isNaN(s)) surfaceCumulee += s;

      if (emb?.immatriculation && !emb.immatriculation.startsWith('DOM-')) {
        nbNavires++;
      } else {
        nbTerrestre++;
      }
    });

    return {
      total: clientsFiltres.length,
      surfaceTotale: surfaceCumulee.toFixed(2),
      navires: nbNavires,
      terrestre: nbTerrestre
    };
  }, [clientsFiltres]);

  const statsRegistre = useMemo(() => {
    const total = clientsDuPort.length;
    const navires = clientsDuPort.filter(
      (c) =>
        c.embarcations &&
        c.embarcations.length > 0 &&
        !c.embarcations[0]?.immatriculation?.startsWith('DOM-')
    ).length;
    return {
      total,
      navires,
      terrePlein: total - navires
    };
  }, [clientsDuPort]);

  const handleSelectClient = (c) => {
    setSelectedClientId(c.id);
    const emb = c.embarcations?.[0] || {};
    const estNavire = Boolean(emb.immatriculation && !emb.immatriculation.startsWith('DOM-'));

    setForm({
      code_client: c.code_client || '',
      nom_prenom: c.nom_prenom || c.nom_proprietaire || '',
      nin: c.nin || '',
      telephone: c.telephone || '',
      adresse: c.adresse || '',
      nature_date: emb.type_date || 'recensement',
      date_evenement: emb.date_recensement || new Date().toISOString().split('T')[0],
      type_contrat: emb.numero_contrat_amarrage ? 'amarrage' : 'amodiation',
      numero_acte: emb.numero_contrat_amarrage || '',
      statut_client: c.statut_client || 'actif',
      famille_activite: estNavire ? 'plan_deau' : 'infrastructures_peche',
      type_activite: emb.type_embarcation || 'sardiniers',
      nom_embarcation: estNavire ? (emb.nom_embarcation || '') : '',
      immatriculation: estNavire ? (emb.immatriculation || '') : '',
      longueur: estNavire ? (emb.longueur || '') : '',
      largeur: estNavire ? (emb.largeur || '') : '',
      designation_bien: !estNavire ? (emb.nom_embarcation || '') : '',
      surface_fixe: !estNavire ? (emb.surface || emb.longueur || '') : '',
      port_recensement: emb.port_recensement || emb.port_attache || activePort,
      registre_commerce: c.registre_commerce || ''
    });
    setFiltreRecherche('');
  };

  const handleReset = () => {
    setSelectedClientId(null);
    setForm(formInitial);
    setFiltreRecherche('');
  };

  const handleSaveOrUpdate = async () => {
    if (!canEdit) {
      setNotification({ type: 'error', text: 'Action refusée : Mode Consultation actif. Droits requis pour ce port.' });
      return;
    }
    if (!form.code_client.trim()) {
      setNotification({ type: 'error', text: 'Veuillez renseigner le Code Client.' });
      return;
    }
    if (!form.nom_prenom.trim()) {
      setNotification({ type: 'error', text: 'Veuillez renseigner le Nom & Prénom / Gérant.' });
      return;
    }

    if (form.famille_activite === 'plan_deau') {
      if (!form.nom_embarcation.trim()) {
        setNotification({ type: 'error', text: "Veuillez renseigner le Nom de l'embarcation." });
        return;
      }
      if (!form.immatriculation.trim()) {
        setNotification({ type: 'error', text: "Veuillez renseigner l'Immatriculation du navire." });
        return;
      }
    } else {
      if (!form.designation_bien.trim()) {
        setNotification({ type: 'error', text: 'Veuillez renseigner la Désignation du Local / Espace.' });
        return;
      }
    }

    setEnCoursEnregistrement(true);

    try {
      const nomComplet = form.nom_prenom.trim();
      const portCible = activePort === 'Direction' ? 'Bouharoun' : activePort;

      const clientPayload = {
        code_client: form.code_client.trim(),
        nom_proprietaire: nomComplet,
        nom_prenom: nomComplet,
        nin: form.nin ? form.nin.trim() : null,
        telephone: form.telephone ? form.telephone.trim() : null,
        adresse: form.adresse ? form.adresse.trim() : null
      };

      if (selectedClientId) {
        const { error } = await supabase
          .from('clients')
          .update(clientPayload)
          .eq('id', selectedClientId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([clientPayload]);
        if (error) throw error;
      }

      const immatFinale =
        form.famille_activite === 'plan_deau'
          ? form.immatriculation.trim()
          : `DOM-${form.code_client.trim()}`;

      const longVal =
        form.famille_activite === 'plan_deau'
          ? parseFloat(form.longueur) || 1
          : parseFloat(form.surface_fixe) || 1;

      const largVal =
        form.famille_activite === 'plan_deau'
          ? parseFloat(form.largeur) || 1
          : 1;

      const embPayload = {
        code_client: form.code_client.trim(),
        nom_embarcation:
          form.famille_activite === 'plan_deau'
            ? form.nom_embarcation.trim()
            : form.designation_bien.trim(),
        type_embarcation: form.type_activite,
        immatriculation: immatFinale,
        longueur: longVal,
        largeur: largVal,
        port_attache: portCible,
        port_recensement: form.port_recensement || portCible,
        date_recensement: form.date_evenement,
        type_date: form.nature_date,
        numero_contrat_amarrage: form.numero_acte ? form.numero_acte.trim() : null
      };

      const { error: errEmb } = await supabase
        .from('embarcations')
        .upsert([embPayload], { onConflict: 'immatriculation' });
      if (errEmb) throw errEmb;

      setNotification({
        type: 'success',
        text: selectedClientId
          ? `Dossier usager mis à jour avec succès sur le port de ${portCible}.`
          : `Nouvel exploitant enregistré avec succès sur le port de ${portCible}.`
      });
      handleReset();
      reloadData();
    } catch (err) {
      setNotification({ type: 'error', text: `Erreur d'enregistrement Supabase : ${err.message}` });
    } finally {
      setEnCoursEnregistrement(false);
    }
  };

  const handleDemandeSuppression = () => {
    if (!selectedClientId) {
      setNotification({ type: 'error', text: 'Veuillez d’abord cliquer sur "Charger" pour sélectionner un usager.' });
      return;
    }
    if (!canEdit) {
      setNotification({ type: 'error', text: 'Action refusée : Mode Consultation actif.' });
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmerSuppression = async () => {
    setShowConfirmModal(false);
    const code = form.code_client;
    const nom = form.nom_prenom;

    try {
      await supabase.from('reglements').delete().eq('code_client', code);
      await supabase.from('factures').delete().eq('code_client', code);
      await supabase.from('embarcations').delete().eq('code_client', code);

      const { error } = await supabase.from('clients').delete().eq('id', selectedClientId);
      if (error) throw error;

      setNotification({ type: 'success', text: `Le dossier de ${nom} (${code}) a été purgé avec succès.` });
      handleReset();
      reloadData();
    } catch (err) {
      setNotification({ type: 'error', text: `Erreur lors de la suppression : ${err.message}` });
    }
  };

  const handleExportCSV = () => {
    if (clientsFiltres.length === 0) {
      setNotification({ type: 'error', text: `Aucun exploitant à exporter pour le port de ${activePort}.` });
      return;
    }
    const entetes = [
      'Code',
      'Nom & Prénom / Gérant',
      'Nom Navire / Bien',
      'Immatriculation',
      'Type Activité',
      'Port Attache',
      'Situation / Présence',
      'Type & Date Constat',
      'Longueur (m)',
      'Largeur (m)',
      'Surface (m2)',
      'N° Acte'
    ];
    const lignes = clientsFiltres.map((c) => {
      const emb = c.embarcations?.[0];
      const situation = emb?.port_recensement && normaliserPort(emb.port_recensement) !== normaliserPort(emb?.port_attache || activePort)
        ? `Déplacé (${emb.port_recensement})`
        : 'Au Port (Conforme)';

      const dateDetail = emb?.date_recensement
        ? `${emb.type_date || 'Recensement'} (${emb.date_recensement})`
        : '-';

      return [
        `"${c.code_client || ''}"`,
        `"${c.nom_prenom || c.nom_proprietaire || ''}"`,
        `"${emb?.nom_embarcation || '-'}"`,
        `"${emb?.immatriculation || '-'}"`,
        `"${emb?.type_embarcation || '-'}"`,
        `"${emb?.port_attache || activePort}"`,
        `"${situation}"`,
        `"${dateDetail}"`,
        `"${emb?.longueur || '0'}"`,
        `"${emb?.largeur || '0'}"`,
        `"${emb?.surface || '0.00'}"`,
        `"${emb?.numero_contrat_amarrage || '-'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [entetes.join(';'), ...lignes.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Registre_Domanial_${activePort}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintTable = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #zone-registre-imprimable, #zone-registre-imprimable * {
            visibility: visible;
          }
          #zone-registre-imprimable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            color: black !important;
          }
          th, td {
            border: 1px solid #ccc !important;
            padding: 6px !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`no-print p-4 rounded-xl text-xs font-bold flex items-center justify-between border shadow-lg ${
            notification.type === 'error'
              ? 'bg-red-950/90 text-red-300 border-red-800'
              : 'bg-emerald-950/90 text-emerald-300 border-emerald-800'
          }`}
        >
          <span>{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white px-2 font-black text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bannière Port Actif & Compteurs Domaniaux */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Port d'Administration</span>
            <h1 className="text-xl font-black text-white">{activePort}</h1>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Inscrits ({activePort})</span>
            <span className="text-xl font-black text-cyan-400">{statsRegistre.total}</span>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <span className="text-[11px] text-slate-400 block font-medium">Flotte Mer</span>
            <span className="text-xl font-black text-emerald-400">{statsRegistre.navires}</span>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <span className="text-[11px] text-slate-400 block font-medium">Terres-pleins</span>
            <span className="text-xl font-black text-amber-400">{statsRegistre.terrePlein}</span>
          </div>
        </div>
      </div>

      {/* Formulaire Principal d'Enregistrement */}
      <div className="no-print bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-black text-cyan-400 tracking-wide">
              {selectedClientId
                ? `Modification de la Fiche : ${form.nom_prenom}`
                : `Fiche d'Enregistrement & Recensement : Exploitant (${activePort})`}
            </h2>
            <p className="text-xs text-slate-400">
              Rattachement domanial et contrôle de présence pour le port de <strong className="text-cyan-300">{activePort}</strong>.
            </p>
          </div>
          <div className="w-full sm:w-80">
            <input
              type="text"
              placeholder={`Rechercher un usager de ${activePort}...`}
              value={filtreRecherche}
              onChange={(e) => setFiltreRecherche(e.target.value)}
              className="w-full bg-slate-950 border border-cyan-700/80 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
        </div>

        {/* Section 1 : Identification & Date de Recensement */}
        <div className="space-y-6">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider block">
              1. Identification de l'Exploitant / Armateur ({activePort})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Code Client *</label>
                <input
                  placeholder="ex: CLT-001"
                  value={form.code_client}
                  onChange={(e) => setForm({ ...form, code_client: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono font-bold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Nom & Prénom / Gérant *</label>
                <input
                  placeholder="Nom et prénom complet"
                  value={form.nom_prenom}
                  onChange={(e) => setForm({ ...form, nom_prenom: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-bold outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">N° NIN / Identité</label>
                <input
                  placeholder="N° NIN"
                  value={form.nin}
                  onChange={(e) => setForm({ ...form, nin: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-amber-400 block mb-1">Nature de la Date *</label>
                <select
                  value={form.nature_date}
                  onChange={(e) => setForm({ ...form, nature_date: e.target.value })}
                  className="w-full bg-slate-900 border border-amber-500/70 text-amber-300 font-bold p-2 rounded text-xs outline-none focus:border-amber-400"
                >
                  <option value="recensement">📋 Constat Recensement</option>
                  <option value="entree_port">⚓ Entrée au Port</option>
                  <option value="contrat_facturation">📜 Effet Contrat (Facturation)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-cyan-400 block mb-1">Date d'Effet / Constat *</label>
                <input
                  type="date"
                  value={form.date_evenement}
                  onChange={(e) => setForm({ ...form, date_evenement: e.target.value })}
                  className="w-full bg-slate-900 border border-cyan-600 p-2 rounded text-xs text-white font-mono font-bold outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Téléphone</label>
                <input
                  placeholder="Téléphone de contact"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Adresse</label>
                <input
                  placeholder="Adresse de résidence ou siège"
                  value={form.adresse}
                  onChange={(e) => setForm({ ...form, adresse: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2 : Activité & Recensement au Port */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-4">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-wider block">
              2. Nature d'Activité & Contrôle de Présence Trimestrielle
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              {FAMILLES.map((fam) => (
                <button
                  type="button"
                  key={fam.id}
                  onClick={() =>
                    setForm({
                      ...form,
                      famille_activite: fam.id,
                      type_activite: fam.types[0].id
                    })
                  }
                  className={`p-3 rounded-xl border text-left font-bold text-xs transition ${
                    form.famille_activite === fam.id
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  {fam.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-900 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Sous-catégorie :</span>
                <select
                  value={form.type_activite}
                  onChange={(e) => setForm({ ...form, type_activite: e.target.value })}
                  className="w-full bg-slate-900 border border-cyan-700 text-cyan-300 font-bold px-3 py-1.5 rounded-lg text-xs outline-none"
                >
                  {FAMILLES.find((f) => f.id === form.famille_activite)?.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Acte Juridique :</span>
                <select
                  value={form.type_contrat}
                  onChange={(e) => setForm({ ...form, type_contrat: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-medium px-3 py-1.5 rounded-lg text-xs outline-none"
                >
                  {TYPES_ACTES.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-900/90 border border-amber-500/40 p-1.5 rounded-lg">
                <span className="text-[11px] text-amber-300 font-bold whitespace-nowrap">Recensé à :</span>
                <select
                  value={form.port_recensement}
                  onChange={(e) => setForm({ ...form, port_recensement: e.target.value })}
                  className="w-full bg-slate-950 border border-amber-600 text-amber-300 font-bold px-2 py-1 rounded text-xs outline-none"
                >
                  {LISTE_PORTS.map((p) => (
                    <option key={p} value={p}>
                      {p} {p === activePort ? '(Port Actuel)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3 : Formulaire Dynamique Plan d'eau / Terrestre */}
          <div className="bg-slate-950 p-5 rounded-xl border border-cyan-500/40 space-y-4">
            {form.famille_activite === 'plan_deau' ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Nom Navire *</label>
                  <input
                    placeholder="Nom navire"
                    value={form.nom_embarcation}
                    onChange={(e) => setForm({ ...form, nom_embarcation: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Immatriculation *</label>
                  <input
                    placeholder="AL-1234"
                    value={form.immatriculation}
                    onChange={(e) => setForm({ ...form, immatriculation: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Longueur (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="L"
                    value={form.longueur}
                    onChange={(e) => setForm({ ...form, longueur: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Largeur (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="l"
                    value={form.largeur}
                    onChange={(e) => setForm({ ...form, largeur: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono outline-none"
                  />
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center font-mono font-bold text-cyan-400 text-xs">
                  Surface : {surfaceAffichee} m²
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Désignation Local / Espace *</label>
                  <input
                    placeholder="ex: Case N° 12 ou Restaurant"
                    value={form.designation_bien}
                    onChange={(e) => setForm({ ...form, designation_bien: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Superficie Concessionnée (m²)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="m²"
                    value={form.surface_fixe}
                    onChange={(e) => setForm({ ...form, surface_fixe: e.target.value })}
                    className="w-full bg-slate-900 border border-cyan-600 p-2 rounded text-xs text-cyan-300 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Réf Contrat / Convention</label>
                  <input
                    placeholder="N° Acte"
                    value={form.numero_acte}
                    onChange={(e) => setForm({ ...form, numero_acte: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-xs text-white font-mono outline-none"
                  />
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-800 text-center font-mono font-bold text-cyan-400 text-xs">
                  Surface : {surfaceAffichee} m²
                </div>
              </div>
            )}
          </div>

          {/* Section 4 : Rangée Complète des Boutons d'Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleSaveOrUpdate}
                disabled={enCoursEnregistrement}
                className="bg-cyan-600 hover:bg-cyan-500 font-bold px-6 py-2.5 rounded-xl text-xs text-white shadow-lg transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {selectedClientId ? '✏️ Modifier' : `➕ Enregistrer pour ${activePort}`}
              </button>

              <button
                type="button"
                onClick={handleDemandeSuppression}
                className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 font-bold px-5 py-2.5 rounded-xl text-xs transition"
              >
                🗑️ Supprimer
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition"
              >
                🔄 Réinitialiser
              </button>

              <button
                type="button"
                onClick={handlePrintTable}
                className="bg-indigo-600 hover:bg-indigo-500 font-bold px-4 py-2.5 rounded-xl text-xs text-white shadow transition flex items-center gap-1.5"
              >
                🖨️ Imprimer Registre
              </button>

              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="bg-purple-600 hover:bg-purple-500 font-bold px-4 py-2.5 rounded-xl text-xs text-white shadow transition flex items-center gap-1.5"
              >
                {isFullScreen ? '🗗 Réduire' : '⛶ Agrandir (Plein Écran)'}
              </button>

              {/* BOUTON FILTRES CHEF DE PORT */}
              <button
                type="button"
                onClick={() => setAfficherFiltresAvances(!afficherFiltresAvances)}
                className={`font-bold px-4 py-2.5 rounded-xl text-xs shadow transition flex items-center gap-1.5 border ${
                  afficherFiltresAvances || nombreFiltresActifs > 0
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 font-black'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
              >
                <span>🔍 Filtres Chef de Port</span>
                {nombreFiltresActifs > 0 && (
                  <span className="bg-slate-950 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                    {nombreFiltresActifs}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-4 py-2.5 rounded-xl text-xs text-white shadow transition"
            >
              📥 Exporter Registre {activePort} (.CSV)
            </button>
          </div>
        </div>
      </div>

      {/* PANNEAU DE FILTRAGE HAUTE DÉFINITION DU CHEF DE PORT */}
      {afficherFiltresAvances && (
        <div className="no-print bg-slate-900 border-2 border-amber-500/60 p-5 rounded-2xl shadow-2xl space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                🧭 Console de Filtrage & Requêtes du Chef de Port ({activePort})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                — Recherche métrique, quartiers maritimes et contrôles de présence
              </span>
            </div>

            {nombreFiltresActifs > 0 && (
              <button
                type="button"
                onClick={handleResetTousFiltres}
                className="text-xs bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 px-3 py-1 rounded-lg font-bold transition flex items-center gap-1"
              >
                ✕ Réinitialiser tous les filtres ({nombreFiltresActifs})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-amber-300 font-bold block mb-1">
                ❓ Requêtes Rapides (Questions Types) :
              </label>
              <select
                value={questionPredefinie}
                onChange={(e) => handleAppliquerQuestionPredefinie(e.target.value)}
                className="w-full bg-slate-950 border border-amber-500/70 text-amber-300 font-bold p-2 rounded-lg text-xs outline-none focus:border-amber-400"
              >
                <option value="">Sélectionner une requête type...</option>
                <option value="sardiniers">🐟 Combien de Sardiniers ?</option>
                <option value="chalutiers">🚢 Combien de Chalutiers ?</option>
                <option value="petit_metiers">🚣 Combien de Petits Métiers ?</option>
                <option value="plaisance">⛵ Combien de Navires de Plaisance ?</option>
                <option value="longueur_16m">📏 Navires mesurant exactement 16 m</option>
                <option value="longueur_gte_16m">📏 Grands navires (Longueur ≥ 16 m)</option>
                <option value="longueur_lte_10m">📏 Petits bateaux (Longueur ≤ 10 m)</option>
                <option value="navires_hors_port">⚠️ Navires Hors Port (Immat AL, CH, MG, OR...)</option>
                <option value="navires_deplaces">🚨 Navires signalés déplacés sur un autre port</option>
                <option value="terres_pleins">🏢 Exploitants du domaine terrestre / Locaux</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">
                🎣 Type d'Activité / Métier :
              </label>
              <select
                value={filtreTypeActivite}
                onChange={(e) => {
                  setFiltreTypeActivite(e.target.value);
                  setQuestionPredefinie('');
                }}
                className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-lg text-xs outline-none focus:border-cyan-500"
              >
                <option value="">Toutes les activités confondues</option>
                <option value="sardiniers">Sardinier</option>
                <option value="chalutiers">Chalutier</option>
                <option value="petit metiers">Petit Métier</option>
                <option value="thoniers">Thonier</option>
                <option value="plaisance">Plaisance</option>
                <option value="servitude">Servitude Portuaire</option>
                <option value="DOM">Domaine Terrestre & Locaux</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">
                📍 Situation de Présence :
              </label>
              <select
                value={filtreSituationPres}
                onChange={(e) => {
                  setFiltreSituationPres(e.target.value);
                  setQuestionPredefinie('');
                }}
                className="w-full bg-slate-950 border border-slate-700 text-white p-2 rounded-lg text-xs outline-none focus:border-cyan-500"
              >
                <option value="">Tous (Au port & Déplacés)</option>
                <option value="au_port">🟢 Présents au Port d'Attache</option>
                <option value="deplace">⚠️ Déplacés / Constatés sur un autre port</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">
                🏷️ Quartier Maritime (Préfixe) :
              </label>
              <select
                value={filtreQuartierImmat}
                onChange={(e) => {
                  setFiltreQuartierImmat(e.target.value);
                  setQuestionPredefinie('');
                }}
                className="w-full bg-slate-950 border border-slate-700 text-cyan-300 font-mono font-bold p-2 rounded-lg text-xs outline-none focus:border-cyan-500"
              >
                {QUARTIERS_MARITIMES.map((q) => (
                  <option key={q.prefix} value={q.prefix}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-300 font-bold block mb-1">
                🔎 Recherche Immatriculation :
              </label>
              <input
                type="text"
                placeholder="ex: AL-5421, CH..."
                value={filtreSaisieImmat}
                onChange={(e) => setFiltreSaisieImmat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white font-mono p-2 rounded-lg text-xs outline-none focus:border-cyan-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] text-slate-300 font-bold block mb-1">
                📏 Filtre Métrage (Longueur en mètres) :
              </label>
              <div className="flex gap-2">
                <select
                  value={filtreLongueurOperateur}
                  onChange={(e) => setFiltreLongueurOperateur(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-cyan-400 font-bold px-2 py-2 rounded-lg text-xs outline-none"
                >
                  <option value="exact">= Égal à</option>
                  <option value="gte">≥ Supérieur ou égal à</option>
                  <option value="lte">≤ Inférieur ou égal à</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  placeholder="ex: 16 (pour 16 m)"
                  value={filtreLongueurExacte}
                  onChange={(e) => {
                    setFiltreLongueurExacte(e.target.value);
                    setQuestionPredefinie('');
                  }}
                  className="w-full bg-slate-950 border border-cyan-700 text-white font-mono font-bold p-2 rounded-lg text-xs outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-800">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                📅 Date Début Période Constat / Arrivée :
              </label>
              <input
                type="date"
                value={filtreDateDebut}
                onChange={(e) => setFiltreDateDebut(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-xs text-white font-mono outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                📅 Date Fin Période :
              </label>
              <input
                type="date"
                value={filtreDateFin}
                onChange={(e) => setFiltreDateFin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-xs text-white font-mono outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Bandeau de statistiques dynamiques */}
          <div className="bg-slate-950 p-3 rounded-xl border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Résultats Filtrés</span>
                <span className="text-base font-black text-cyan-400 font-mono">
                  {statsResultatsFiltres.total} usager(s)
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Flotte Navires</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {statsResultatsFiltres.navires} unités
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Domaine Terrestre</span>
                <span className="text-base font-black text-amber-400 font-mono">
                  {statsResultatsFiltres.terrestre} locaux
                </span>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-[10px] uppercase text-slate-400 font-bold block">Surface Totale Occupée</span>
                <span className="text-base font-black text-purple-400 font-mono">
                  {statsResultatsFiltres.surfaceTotale} m²
                </span>
              </div>
            </div>

            {nombreFiltresActifs > 0 && (
              <span className="text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-800 px-3 py-1 rounded-lg">
                ⚡ Filtrage actif sur {statsResultatsFiltres.total} résultat(s)
              </span>
            )}
          </div>
        </div>
      )}

      {/* TABLEAU DU REGISTRE DOMANIAL OFFICIEL */}
      <div
        id="zone-registre-imprimable"
        className={`bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all ${
          isFullScreen ? 'fixed inset-4 z-50 overflow-y-auto bg-slate-950 p-6' : ''
        }`}
      >
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-200">
              Registre Domanial — Port de <span className="text-cyan-400 font-black">{activePort}</span>
            </span>
            <span className="bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
              {clientsFiltres.length} exploitant(s) affiché(s)
            </span>
            {nombreFiltresActifs > 0 && (
              <span className="bg-amber-950 border border-amber-700 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Filtres actifs : {nombreFiltresActifs}
              </span>
            )}
          </div>

          <div className="no-print flex items-center gap-2">
            <select
              value={periodeRegistre}
              onChange={(e) => setPeriodeRegistre(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded p-1 text-xs outline-none"
            >
              <option value="global">Tout afficher ({activePort})</option>
              <option value="derniers_5">5 derniers enregistrés</option>
            </select>

            {isFullScreen && (
              <button
                type="button"
                onClick={() => setIsFullScreen(false)}
                className="bg-red-800 hover:bg-red-700 text-white text-xs px-3 py-1 rounded-lg font-bold"
              >
                ✕ Fermer Plein Écran
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
              <tr>
                <th className="p-3">1. Code</th>
                <th className="p-3">2. Nom & Prénom / Gérant</th>
                <th className="p-3">3. Nom Navire / Bien</th>
                <th className="p-3">4. Immatriculation</th>
                <th className="p-3">5. Type d'Activité</th>
                <th className="p-3">6. Port Attache</th>
                <th className="p-3">7. Situation / Présence</th>
                <th className="p-3">8. Dimensions & Surface</th>
                <th className="p-3">9. Acte Juridique</th>
                <th className="p-3 text-right no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {clientsFiltres.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-slate-500">
                    Aucun usager enregistré pour le port de <span className="text-cyan-400 font-bold">{activePort}</span>.
                  </td>
                </tr>
              ) : (
                clientsFiltres.map((c) => {
                  const emb = c.embarcations?.[0];
                  const portAttacheEmb = emb?.port_attache || activePort;
                  const portConstat = emb?.port_recensement || portAttacheEmb;
                  const estDeplace = normaliserPort(portConstat) !== normaliserPort(portAttacheEmb);

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-mono font-bold text-cyan-400">{c.code_client}</td>
                      <td className="p-3 font-bold text-white">{c.nom_prenom || c.nom_proprietaire}</td>
                      <td className="p-3 text-white font-medium">{emb?.nom_embarcation || 'Concession standard'}</td>
                      <td className="p-3 font-mono text-cyan-300 font-bold">{emb?.immatriculation || '-'}</td>
                      <td className="p-3 text-slate-300">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {emb?.type_embarcation || 'Activité Domaniale'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          {portAttacheEmb}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {estDeplace ? (
                            <span className="inline-flex items-center gap-1 bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              ⚠️ Signalé à {portConstat}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                              🟢 Au Port ({portAttacheEmb})
                            </span>
                          )}

                          {emb?.date_recensement && (
                            <div className="text-[10px] font-mono text-slate-400">
                              <span className="text-amber-300 font-medium">
                                {emb.type_date === 'entree_port'
                                  ? '⚓ Entrée : '
                                  : emb.type_date === 'contrat_facturation'
                                  ? '📜 Contrat : '
                                  : '📋 Recensé : '}
                              </span>
                              {emb.date_recensement}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <span className="text-cyan-400 font-bold">{emb?.surface ? `${emb.surface} m²` : '-'}</span>
                        {emb?.longueur && emb?.largeur && (
                          <span className="text-slate-500 text-[10px] block">
                            ({emb.longueur}m × {emb.largeur}m)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-300 font-mono text-[11px]">
                        {emb?.numero_contrat_amarrage ? (
                          <span className="text-slate-200">Acte N° {emb.numero_contrat_amarrage}</span>
                        ) : (
                          <span className="text-slate-500 italic">Non renseigné</span>
                        )}
                      </td>
                      <td className="p-3 text-right no-print">
                        <button
                          type="button"
                          onClick={() => handleSelectClient(c)}
                          className="bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-3 py-1 rounded-lg text-xs font-bold transition"
                        >
                          Charger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CONFIRMATION DE SUPPRESSION SÉCURISÉE */}
      {showConfirmModal && (
        <div className="no-print fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-red-400 font-black text-sm uppercase tracking-wider">
              ⚠️ Attention - Suppression Définitive
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement l'usager :
              <br />
              <strong className="text-white block mt-1">Nom : {form.nom_prenom}</strong>
              <strong className="text-cyan-300 block font-mono">Code Client : {form.code_client}</strong>
              <strong className="text-amber-300 block">Port : {activePort}</strong>
            </p>
            <p className="text-[11px] text-slate-400 bg-red-950/40 p-2.5 rounded-lg border border-red-900/50">
              Toutes ses factures, quittances de règlement et biens affectés seront purgés en cascade.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmerSuppression}
                className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
