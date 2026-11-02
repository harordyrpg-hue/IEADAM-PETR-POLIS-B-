import React, { useState, useEffect } from 'react';
import { Church, Menu, X, MapPin, Phone, MessageCircle } from 'lucide-react';
import { ChurchProfile } from '../../types.js';

interface ChurchPublicNavbarProps {
  profile: ChurchProfile;
}

export const ChurchPublicNavbar: React.FC<ChurchPublicNavbarProps> = ({ profile }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Início', href: '#inicio' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Avisos', href: '#avisos' },
    { label: 'Cultos & Agenda', href: '#agenda' },
    { label: 'Devocionais', href: '#devocionais' },
    { label: 'Fotos & Vídeos', href: '#galeria' },
    { label: 'Downloads', href: '#downloads' },
    { label: 'Contato', href: '#contato' },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const whatsappClean = profile.contact.whatsapp.replace(/\D/g, '');

  return (
    <>
      {/* Top Banner Bar for Service Hours / Welcoming */}
      <div className="bg-stone-900 text-stone-300 text-xs py-1.5 px-4 border-b border-stone-800 hidden sm:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-stone-300">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>{profile.contact.cityState}</span>
            </span>
            <span className="text-stone-600">•</span>
            <span className="text-stone-400">
              Cultos: Domingo 09h e 18h30 | Quarta 19h30
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile.contact.phone && (
              <a
                href={`tel:${profile.contact.phone}`}
                className="flex items-center gap-1 text-stone-300 hover:text-amber-400 transition-colors"
              >
                <Phone className="w-3 h-3 text-amber-500" />
                <span>{profile.contact.phone}</span>
              </a>
            )}
            {whatsappClean && (
              <a
                href={`https://wa.me/55${whatsappClean}?text=Ol%C3%A1!%20Gostaria%20de%20informa%C3%A7%C3%B5es%20sobre%20a%20igreja.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Main Sticky Navbar */}
      <nav
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-stone-900/95 dark:bg-stone-950/95 backdrop-blur-md shadow-md border-b border-stone-800'
            : 'bg-stone-900/90 dark:bg-stone-950/90 backdrop-blur-sm border-b border-stone-800/80'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Church Identity / Logo */}
            <a
              href="#inicio"
              onClick={(e) => handleLinkClick(e, '#inicio')}
              className="flex items-center gap-3 group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md shadow-amber-900/30 group-hover:scale-105 transition-transform">
                <Church className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base md:text-lg text-white tracking-tight leading-tight group-hover:text-amber-400 transition-colors">
                  {profile.name}
                </span>
                <span className="text-[11px] text-stone-400 truncate max-w-[220px] sm:max-w-xs">
                  {profile.slogan}
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:flex items-center gap-1 xl:gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleLinkClick(e, link.href)}
                  className="px-3 py-2 text-xs xl:text-sm font-medium text-stone-300 hover:text-amber-400 hover:bg-stone-800/60 rounded-lg transition-colors cursor-pointer"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right Action: Conheça-nos / WhatsApp */}
            <div className="hidden sm:flex items-center gap-2">
              {whatsappClean && (
                <a
                  href={`https://wa.me/55${whatsappClean}?text=Ol%C3%A1!%20Paz%20do%20Senhor!%20Gostaria%20de%20visitar%20a%20igreja.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Fale Conosco</span>
                </a>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-stone-300 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
                aria-label="Abrir menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-stone-800 bg-stone-900/98 backdrop-blur-xl px-4 pt-3 pb-6 space-y-1 animate-in slide-in-from-top-4 duration-200">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleLinkClick(e, link.href)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-stone-200 hover:text-amber-400 hover:bg-stone-800 transition-colors"
              >
                {link.label}
              </a>
            ))}

            {whatsappClean && (
              <div className="pt-3 border-t border-stone-800 mt-2">
                <a
                  href={`https://wa.me/55${whatsappClean}?text=Ol%C3%A1!%20Paz%20do%20Senhor!%20Gostaria%20de%20visitar%20a%20igreja.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-xs shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar mensagem no WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  );
};
