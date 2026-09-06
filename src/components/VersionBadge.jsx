// src/components/VersionBadge.jsx
import React from 'react';

// Constantes de versioning sémantique intégrées (aucune dépendance externe requise)
export const APP_VERSION = "1.0.0";
export const RELEASE_NAME = "Registre Domanial & Console Chef de Port";
export const BUILD_DATE = "2026-09-07";

export default function VersionBadge() {
  return (
    <div 
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 shadow-sm select-none"
      title={`Compilation de production : ${BUILD_DATE}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-bold text-cyan-400 tracking-wider">v{APP_VERSION}</span>
      <span className="text-slate-600">|</span>
      <span className="text-slate-400 font-sans truncate max-w-[200px]">{RELEASE_NAME}</span>
    </div>
  );
}