import React, { useState, useEffect } from 'react';
import { Briefcase, ClipboardCheck, DollarSign, Droplets } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { AttendanceView } from './AttendanceView.js';
import { FinancialView } from './FinancialView.js';
import { BaptismView } from './BaptismView.js';

export type SecretariatSubTab = 'baptism' | 'attendance' | 'finances';

interface SecretariatViewProps {
  initialSubTab?: SecretariatSubTab;
}

export const SecretariatView: React.FC<SecretariatViewProps> = ({
  initialSubTab = 'baptism',
}) => {
  const { canAccessFinances } = useApp();
  const [subTab, setSubTab] = useState<SecretariatSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  useEffect(() => {
    if (subTab === 'finances' && !canAccessFinances) {
      setSubTab('baptism');
    }
  }, [subTab, canAccessFinances]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Unified Secretariat Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-100">Secretaria</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Central administrativa: Batismo nas Águas, Chamadas &amp; Ficha de Membros e Financeiro.
            </p>
          </div>
        </div>

        <nav
          aria-label="Abas da Secretaria"
          className="flex flex-wrap items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl"
        >
          <button
            type="button"
            onClick={() => setSubTab('baptism')}
            className={`inline-flex items-center gap-2 px-4 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'baptism'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>Batismo</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('attendance')}
            className={`inline-flex items-center gap-2 px-4 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              subTab === 'attendance'
                ? 'bg-amber-400 text-neutral-950 font-bold'
                : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Chamadas</span>
          </button>

          {canAccessFinances && (
            <button
              type="button"
              onClick={() => setSubTab('finances')}
              className={`inline-flex items-center gap-2 px-4 min-h-[38px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                subTab === 'finances'
                  ? 'bg-amber-400 text-neutral-950 font-bold'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Financeiro</span>
            </button>
          )}
        </nav>
      </div>

      {/* Sub-Tab Content */}
      {subTab === 'baptism' && <BaptismView />}
      {subTab === 'attendance' && <AttendanceView />}
      {subTab === 'finances' && canAccessFinances && <FinancialView />}
    </div>
  );
};
