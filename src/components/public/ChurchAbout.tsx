import React from 'react';
import { Target, Compass, Shield, Users, BookOpen, CheckCircle } from 'lucide-react';
import { ChurchProfile } from '../../types.js';
import { SafeMarkdownRenderer } from '../../utils/safeMarkdown.js';

interface ChurchAboutProps {
  profile: ChurchProfile;
}

export const ChurchAbout: React.FC<ChurchAboutProps> = ({ profile }) => {
  return (
    <section id="sobre" className="py-20 md:py-28 bg-stone-900 text-stone-100 border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Quem Somos</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Sobre a Nossa Igreja
          </h2>
          <p className="text-stone-400 text-sm sm:text-base leading-relaxed">
            Conheça os propósitos, os valores e as pessoas dedicadas a servir a Deus e edificar vidas em nossa comunidade.
          </p>
        </div>

        {/* History Block */}
        <div className="bg-stone-950/80 border border-stone-800 rounded-3xl p-6 sm:p-10 mb-16 shadow-xl relative overflow-hidden">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-3">
              <span className="w-2.5 h-7 rounded bg-amber-500" />
              Nossa História e Raízes
            </h3>
            <div className="text-stone-300 text-sm sm:text-base leading-relaxed">
              <SafeMarkdownRenderer content={profile.history} />
            </div>
          </div>
        </div>

        {/* Mission, Vision & Values Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Mission */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-6 sm:p-8 hover:border-amber-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
              <Target className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Nossa Missão</h4>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {profile.mission}
            </p>
          </div>

          {/* Vision */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-6 sm:p-8 hover:border-amber-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
              <Compass className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Nossa Visão</h4>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {profile.vision}
            </p>
          </div>

          {/* Values */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-2xl p-6 sm:p-8 hover:border-amber-500/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5">
              <Shield className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white mb-3">Nossos Valores</h4>
            <ul className="space-y-2">
              {profile.values && profile.values.map((val, idx) => (
                <li key={idx} className="flex items-start gap-2 text-stone-300 text-xs sm:text-sm">
                  <CheckCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Leadership Section */}
        {profile.leadership && profile.leadership.length > 0 && (
          <div>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>Corpo Pastoral & Liderança</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                Servindo com Amor e Dedicação
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {profile.leadership.map((leader) => (
                <div
                  key={leader.id}
                  className="bg-stone-950 border border-stone-800 rounded-2xl overflow-hidden shadow-lg group hover:border-amber-500/40 transition-all"
                >
                  <div className="aspect-4/3 sm:aspect-square w-full overflow-hidden bg-stone-900">
                    <img
                      src={
                        leader.photoUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                      }
                      alt={leader.name}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5">
                    <h4 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                      {leader.name}
                    </h4>
                    <p className="text-xs font-medium text-amber-500 mb-2">
                      {leader.role}
                    </p>
                    {leader.bio && (
                      <p className="text-xs text-stone-400 leading-relaxed line-clamp-3">
                        {leader.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
