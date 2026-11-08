import React, { useEffect, useRef, useState } from 'react';
import { Tv, Square, Minimize2, Maximize2, Radio } from 'lucide-react';
import { useApp } from '../../context/AppContext.js';

export const ScreenTransmissionWidget: React.FC = () => {
  const { isTransmitting, transmissionStream, stopTransmission } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (videoRef.current && transmissionStream) {
      videoRef.current.srcObject = transmissionStream;
    }
  }, [transmissionStream, isTransmitting]);

  // Only visible on computer/desktop when transmission is active
  if (!isTransmitting) return null;

  return (
    <div className="hidden md:flex fixed bottom-6 right-6 z-50 flex-col bg-neutral-900 border border-rose-500/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 w-80 text-neutral-100 select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-950/80 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
          </span>
          <span className="text-xs font-bold text-rose-300 tracking-wide">
            TRANSMITINDO P/ A TELA
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
            title={isMinimized ? 'Expandir monitor' : 'Minimizar monitor'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Video Preview & Controls (when not minimized) */}
      {!isMinimized && (
        <div className="p-3 space-y-3">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-neutral-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] text-neutral-300 font-mono flex items-center gap-1 border border-neutral-700/60">
              <Tv className="w-3 h-3 text-amber-400" />
              <span>Monitor do Telão</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-400 truncate">
              Tela do computador conectada
            </span>

            <button
              onClick={stopTransmission}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-rose-600/30"
              title="Parar de transmitir agora"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Parar de transmitir</span>
            </button>
          </div>
        </div>
      )}

      {/* Minimized Footer Bar */}
      {isMinimized && (
        <div className="p-2.5 flex items-center justify-between gap-2">
          <span className="text-xs text-neutral-300 font-medium">Ao vivo na tela</span>
          <button
            onClick={stopTransmission}
            className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Parar</span>
          </button>
        </div>
      )}
    </div>
  );
};
