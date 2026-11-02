import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Share2,
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  FastForward,
  Rewind,
} from 'lucide-react';
import { useApp } from '../../context/AppContext.js';
import { formatBytes } from '../../utils/formatters.js';
import { api } from '../../services/api.js';

export const AudioPlayerModal: React.FC = () => {
  const {
    audioPlayerFile,
    setAudioPlayerFile,
    setShareTarget,
    notify,
  } = useApp();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('00:00');
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime('00:00');
  }, [audioPlayerFile]);

  if (!audioPlayerFile) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curr = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 1;
    setProgress((curr / dur) * 100);

    const mins = Math.floor(curr / 60);
    const secs = Math.floor(curr % 60);
    setCurrentTime(`${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    const dur = audioRef.current.duration || 1;
    audioRef.current.currentTime = (val / 100) * dur;
    setProgress(val);
  };

  const handleDownload = () => {
    api.triggerDownload(`/api/files/${audioPlayerFile.id}/download`);
    notify(`Iniciando download do áudio master WAV/MP3 (${formatBytes(audioPlayerFile.size)})`, 'info');
  };

  const handleShare = () => {
    setShareTarget({ type: 'file', id: audioPlayerFile.id, name: audioPlayerFile.name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-100 text-xs">
        {/* Audio Element */}
        <audio
          ref={audioRef}
          src={`/storage/originals/${audioPlayerFile.storageKey}`}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-neutral-200 text-sm block truncate max-w-xs">
                {audioPlayerFile.name}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono-numbers">
                {formatBytes(audioPlayerFile.size)} · Master 24-bit PCM
              </span>
            </div>
          </div>
          <button
            onClick={() => setAudioPlayerFile(null)}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Waveform graphic visualization */}
        <div className="my-6 p-4 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-center gap-1 h-24">
          {[40, 65, 30, 85, 95, 45, 70, 60, 90, 100, 75, 50, 80, 65, 45, 90, 70, 55, 80, 60, 40, 75, 90, 60].map((h, i) => (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-300 ${
                (i / 24) * 100 <= progress
                  ? 'bg-amber-400'
                  : 'bg-neutral-800'
              }`}
              style={{ height: `${isPlaying ? Math.max(15, (h * (0.8 + Math.random() * 0.4))) : h}%` }}
            />
          ))}
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1 mb-6">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
          />
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-numbers">
            <span>{currentTime}</span>
            <span>{audioPlayerFile.duration || '04:15'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
                }
              }}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              title="Voltar 10s"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-amber-400 hover:bg-amber-300 text-neutral-950 flex items-center justify-center shadow-lg transition-transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.min(
                    audioRef.current.duration || 0,
                    audioRef.current.currentTime + 10
                  );
                }
              }}
              className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
              title="Avançar 10s"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Áudio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
