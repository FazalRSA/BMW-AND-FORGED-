/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrochureLead } from '../types';
import { 
  X, 
  Database, 
  Download, 
  Trash2, 
  Search, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Car,
  FileSpreadsheet
} from 'lucide-react';

interface LeadsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: BrochureLead[];
  onClearLeads: () => void;
}

export const LeadsManagerModal: React.FC<LeadsManagerModalProps> = ({
  isOpen,
  onClose,
  leads,
  onClearLeads
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.surname.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.cellNumber.includes(search) ||
      l.carModel.toLowerCase().includes(search.toLowerCase()) ||
      l.wheelModel.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCSV = () => {
    if (leads.length === 0) {
      alert('No leads to export yet.');
      return;
    }

    const headers = [
      'ID',
      'Name',
      'Surname',
      'Email',
      'Cell Number',
      'Car Model',
      'Paint Color',
      'Wheel Model',
      'Wheel Finish',
      'Wheel Size',
      'Caliper Color',
      'Consultation Requested',
      'Notes',
      'Date Submitted'
    ];

    const rows = leads.map((l) => [
      l.id,
      `"${l.name}"`,
      `"${l.surname}"`,
      `"${l.email}"`,
      `"${l.cellNumber}"`,
      `"${l.carModel}"`,
      `"${l.paintColor}"`,
      `"${l.wheelModel}"`,
      `"${l.wheelFinish}"`,
      `"${l.wheelSize}"`,
      `"${l.caliperColor}"`,
      l.requestFitmentConsultation ? 'Yes' : 'No',
      `"${l.notes || ''}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apex_forged_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-black border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[88vh] ring-1 ring-white/[0.06]">
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-white/[0.08] bg-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#FF5500]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-white uppercase tracking-tight font-mono">
                  Brochure Inquiries & Leads
                </h2>
                <span className="bg-[#FF5500] text-black text-xs font-mono font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(255,85,0,0.3)]">
                  {leads.length} Total
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Customer contact details & BMW bespoke wheel specifications
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-white/[0.08] bg-black flex flex-col sm:flex-row items-center justify-between gap-3 font-mono">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leads by name, email, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-white/[0.12] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5500] focus:ring-1 focus:ring-[#FF5500] transition-all font-sans"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCSV}
              disabled={leads.length === 0}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-neutral-200 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-medium border border-white/[0.12] transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm('Clear all stored leads? This action cannot be undone.')) {
                  onClearLeads();
                }
              }}
              disabled={leads.length === 0}
              className="flex items-center gap-1.5 bg-neutral-950 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 px-3.5 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Leads Table / List */}
        <div className="overflow-y-auto flex-1 p-4 bg-black">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 space-y-2 font-mono">
              <Database className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-semibold">No brochure leads collected yet</p>
              <p className="text-xs text-neutral-500">
                When a user clicks "Get Brochure" and submits their contact info, it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 font-mono">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="bg-neutral-950 hover:border-white/[0.2] border border-white/[0.08] rounded-xl p-4 transition-all space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">
                        {lead.name} {lead.surname}
                      </span>
                      {lead.requestFitmentConsultation && (
                        <span className="bg-[#FF5500]/15 text-[#FF5500] text-[10px] px-2 py-0.5 rounded-full border border-[#FF5500]/30 font-bold">
                          Fitment Consult Requested
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {new Date(lead.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-neutral-300 font-sans">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                      <a href={`mailto:${lead.email}`} className="hover:underline truncate text-white">
                        {lead.email}
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                      <a href={`tel:${lead.cellNumber}`} className="hover:underline font-mono text-neutral-300">
                        {lead.cellNumber}
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-[#FF5500] shrink-0" />
                      <span className="truncate font-semibold text-white">{lead.carModel}</span>
                    </div>
                  </div>

                  {/* Build Specs Pill row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-neutral-400">
                    <span className="bg-black px-2 py-0.5 rounded border border-white/[0.08] text-neutral-300">
                      Paint: {lead.paintColor}
                    </span>
                    <span className="bg-black px-2 py-0.5 rounded border border-[#FF5500]/30 text-[#FF5500] font-semibold">
                      Wheel: {lead.wheelModel}
                    </span>
                    <span className="bg-black px-2 py-0.5 rounded border border-white/[0.08] text-neutral-300">
                      Finish: {lead.wheelFinish}
                    </span>
                    <span className="bg-black px-2 py-0.5 rounded border border-white/[0.08] text-neutral-300">
                      Size: {lead.wheelSize}
                    </span>
                  </div>

                  {lead.notes && (
                    <div className="text-[11px] text-neutral-400 bg-black/80 p-2.5 rounded border border-white/[0.06] mt-1 font-sans">
                      <span className="text-[#FF5500] font-mono font-medium">Customer note: </span>
                      {lead.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
