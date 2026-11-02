import React from 'react';
import { ChurchProfile } from '../../types';
import { Church, Heart, ChevronUp } from 'lucide-react';

interface ChurchPublicFooterProps {
  profile: ChurchProfile;
}

export const ChurchPublicFooter: React.FC<ChurchPublicFooterProps> = ({ profile }) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { label: 'Início', href: '#inicio' },
    { label: 'Sobre Nós', href: '#sobre' },
    { label: 'Comunicados', href: '#comunicados' },
    { label: 'Agenda & Cultos', href: '#agenda' },
    { label: 'Devocionais', href: '#devocionais' },
    { label: 'Galeria', href: '#galeria' },
    { label: 'Downloads', href: '#downloads' },
    { label: 'Contato', href: '#contato' },
  ];

  return (
    <footer className="bg-stone-950 text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Brand & Slogan */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {profile.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt={profile.name}
                  className="w-10 h-10 rounded-xl object-cover border border-amber-600/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Church className="w-6 h-6" />
                </div>
              )}
              <span className="font-serif font-bold text-lg text-white">
                {profile.name}
              </span>
            </div>

            <p className="text-stone-300 text-sm leading-relaxed">
              {profile.slogan || 'Uma igreja acolhedora, comprometida com a Palavra de Deus e o amor ao próximo.'}
            </p>

            {profile.highlightVerse?.text && (
              <p className="text-amber-400 text-xs italic border-l-2 border-amber-600 pl-3 py-1">
                "{profile.highlightVerse.text}"
                {profile.highlightVerse.reference && (
                  <span className="block not-italic font-semibold mt-0.5 text-stone-400">
                    — {profile.highlightVerse.reference}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-b border-stone-800 pb-2">
              Navegação
            </h4>
            <ul className="space-y-2 text-sm">
              {navLinks.slice(0, 4).map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="hover:text-amber-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* More Public Links */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-b border-stone-800 pb-2">
              Recursos
            </h4>
            <ul className="space-y-2 text-sm">
              {navLinks.slice(4).map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="hover:text-amber-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Cultos & Encontros Summary */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-4 border-b border-stone-800 pb-2">
              Reuniões Principais
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-stone-300">
              {(profile.serviceTimes || []).slice(0, 3).map((s) => (
                <li key={s.id} className="flex justify-between items-center text-xs">
                  <span className="text-stone-300">{s.day} - {s.title}</span>
                  <span className="text-amber-400 font-medium">{s.time}</span>
                </li>
              ))}
              <li className="pt-2 text-xs text-stone-400">
                Todos são bem-vindos!
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p className="flex items-center gap-1.5 text-center sm:text-left">
            &copy; {new Date().getFullYear()} {profile.name}. Todos os direitos reservados.
          </p>

          <p className="flex items-center gap-1 text-stone-400">
            Edificando vidas com <Heart className="w-3.5 h-3.5 text-red-500 fill-current inline" /> para o Reino de Deus.
          </p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-stone-400 hover:text-amber-400 transition-colors"
          >
            <span>Voltar ao topo</span>
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

      </div>
    </footer>
  );
};
