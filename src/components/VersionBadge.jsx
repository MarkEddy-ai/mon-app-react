// src/components/VersionBadge.jsx
import React from 'react';
import { APP_VERSION, RELEASE_NAME, BUILD_DATE } from '../version';

export default function VersionBadge() {
  return (
    <div 
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-sm"
      title={`Date de compilation : ${BUILD_DATE}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      <span className="font-bold text-cyan-400 tracking-wider">v{APP_VERSION}</span>
      <span className="text-slate-600">|</span>
      <span className="text-slate-400 font-sans truncate max-w-[220px]">{RELEASE_NAME}</span>
    </div>
  );
}
