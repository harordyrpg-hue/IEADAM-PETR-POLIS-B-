import React from 'react';
import { Calendar, MapPin, Heart, ChevronRight, BookOpen, Quote } from 'lucide-react';
import { ChurchProfile } from '../../types.js';

interface ChurchHeroProps {
  profile: ChurchProfile;
}

export const ChurchHero: React.FC<ChurchHeroProps> = ({ profile }) => {
  return (
    <section id="inicio" className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-stone-950 text-white">
      {/* Background Banner with warm gradient overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={profile.heroBannerUrl}
          alt={profile.name}
          className="w-full h-full object-cover object-center brightness-45 scale-105 transform animate-in fade-in duration-1000"
        />
        <div className="absolute inset-0 bg-linear-to-t from-stone-950 via-stone-950/70 to-stone-950/40" />
        <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-black/60" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center flex flex-col items-center">
        {/* Welcome Tag */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold tracking-wide uppercase mb-6 shadow-lg backdrop-blur-md animate-in fade-in duration-700">
          <Heart className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Família da Fé • Petrópolis B</span>
        </div>

        {/* Church Name and Main Title */}
        <h1 className="text-3.5xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight mb-4 max-w-4xl">
          {profile.name}
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-stone-300 max-w-2xl font-light mb-8 leading-relaxed">
          {profile.welcomeMessage || profile.slogan}
        </p>

        {/* Featured Verse Card */}
        {profile.highlightVerse && profile.highlightVerse.text && (
          <div className="w-full max-w-2xl mx-auto mb-10 p-5 sm:p-6 rounded-2xl bg-stone-900/80 border border-stone-800/80 backdrop-blur-md shadow-2xl text-left relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-linear-to-b from-amber-400 to-amber-600" />
            <Quote className="w-8 h-8 text-amber-500/20 absolute right-4 top-4" />
            <p className="text-sm sm:text-base text-stone-200 italic leading-relaxed pl-2 font-serif">
              "{profile.highlightVerse.text}"
            </p>
            <p className="text-xs sm:text-sm text-amber-400 font-semibold mt-3 pl-2 tracking-wide">
              — {profile.highlightVerse.reference}
            </p>
          </div>
        )}

        {/* Call to action buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <a
            href="#agenda"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#agenda')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm shadow-xl shadow-amber-950/40 transition-all hover:scale-102 active:scale-98"
          >
            <Calendar className="w-4 h-4" />
            <span>Horários dos Cultos</span>
            <ChevronRight className="w-4 h-4" />
          </a>

          <a
            href="#contato"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#contato')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 text-stone-200 hover:text-white font-semibold text-sm backdrop-blur-md transition-all active:scale-98"
          >
            <MapPin className="w-4 h-4 text-amber-400" />
            <span>Como Chegar</span>
          </a>

          <a
            href="#sobre"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#sobre')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 border border-stone-700/80 text-stone-200 hover:text-white font-semibold text-sm backdrop-blur-md transition-all active:scale-98"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Nossa História</span>
          </a>
        </div>
      </div>
    </section>
  );
};
