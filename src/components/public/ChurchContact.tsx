import React from 'react';
import { ChurchProfile } from '../../types';
import { MapPin, Phone, Mail, Clock, ExternalLink, MessageCircle, Instagram, Youtube, Facebook } from 'lucide-react';

interface ChurchContactProps {
  profile: ChurchProfile;
}

export const ChurchContact: React.FC<ChurchContactProps> = ({ profile }) => {
  const whatsappDigits = (profile.contact.whatsapp || profile.contact.phone || '').replace(/\D/g, '');
  const cleanAddress = [profile.contact.address, profile.contact.cityState].filter(Boolean).join(', ');
  const mapsSearchUrl = profile.contact.mapsLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress || profile.name)}`;

  return (
    <section id="contato" className="py-20 bg-stone-900 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block text-amber-400 font-semibold text-sm tracking-wider uppercase bg-amber-950/60 border border-amber-800/60 px-3.5 py-1 rounded-full mb-3">
            Venha nos Visitar
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
            Localização e Contato
          </h2>
          <p className="text-stone-300 text-base sm:text-lg">
            Estamos de portas abertas para receber você e sua família. Fale conosco ou venha participar de uma de nossas reuniões.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Address Card */}
            <div className="bg-stone-850 p-6 rounded-2xl border border-stone-800 shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">Nosso Endereço</h3>
                  <p className="text-stone-300 text-sm leading-relaxed mb-3">
                    {cleanAddress || 'Endereço da igreja disponível em breve'}
                  </p>
                  <a
                    href={mapsSearchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    Abrir no Google Maps <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Phone & WhatsApp Card */}
            <div className="bg-stone-850 p-6 rounded-2xl border border-stone-800 shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div className="space-y-3 flex-1">
                  <h3 className="font-semibold text-white text-lg">Telefone & WhatsApp</h3>
                  
                  {profile.contact.phone && (
                    <div>
                      <span className="text-xs text-stone-400 block">Telefone da Secretaria:</span>
                      <a
                        href={`tel:${profile.contact.phone.replace(/\D/g, '')}`}
                        className="text-stone-200 hover:text-white font-medium text-sm"
                      >
                        {profile.contact.phone}
                      </a>
                    </div>
                  )}

                  {profile.contact.whatsapp && (
                    <div className="pt-2">
                      <a
                        href={`https://wa.me/${whatsappDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm shadow-md shadow-emerald-900/30 transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Conversar no WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Email & Social Links Card */}
            <div className="bg-stone-850 p-6 rounded-2xl border border-stone-800 shadow-md">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1">E-mail</h3>
                  <a
                    href={`mailto:${profile.contact.email}`}
                    className="text-stone-300 hover:text-amber-400 text-sm transition-colors break-all"
                  >
                    {profile.contact.email || 'contato@igreja.org'}
                  </a>
                </div>
              </div>

              {/* Social Channels */}
              <div className="pt-4 border-t border-stone-800">
                <span className="text-xs text-stone-400 block mb-3 font-medium">Siga nossas redes sociais:</span>
                <div className="flex items-center gap-3">
                  {profile.social?.instagram && (
                    <a
                      href={profile.social.instagram.startsWith('http') ? profile.social.instagram : `https://instagram.com/${profile.social.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-pink-950/60 hover:text-pink-400 text-stone-300 border border-stone-700 transition-colors"
                      title="Instagram"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}

                  {profile.social?.youtube && (
                    <a
                      href={profile.social.youtube.startsWith('http') ? profile.social.youtube : `https://youtube.com/${profile.social.youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-red-950/60 hover:text-red-400 text-stone-300 border border-stone-700 transition-colors"
                      title="YouTube"
                    >
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}

                  {profile.social?.facebook && (
                    <a
                      href={profile.social.facebook.startsWith('http') ? profile.social.facebook : `https://facebook.com/${profile.social.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-stone-800 hover:bg-blue-950/60 hover:text-blue-400 text-stone-300 border border-stone-700 transition-colors"
                      title="Facebook"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Service Hours Reminder */}
            {profile.serviceTimes && profile.serviceTimes.length > 0 && (
              <div className="bg-stone-850 p-6 rounded-2xl border border-stone-800 shadow-md">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="w-full">
                    <h3 className="font-semibold text-white text-lg mb-2">Horários de Cultos</h3>
                    <ul className="space-y-1.5 text-xs sm:text-sm text-stone-300">
                      {profile.serviceTimes.map((sch) => (
                        <li key={sch.id} className="flex justify-between items-center py-1 border-b border-stone-800/60 last:border-0">
                          <span className="font-medium text-stone-200">{sch.day} - {sch.title}</span>
                          <span className="text-amber-400 font-mono font-semibold">{sch.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Interactive Map Column */}
          <div className="lg:col-span-7 h-full flex flex-col">
            <div className="bg-stone-850 rounded-2xl border border-stone-800 p-3 shadow-md flex-1 min-h-[420px] flex flex-col">
              <div className="relative w-full flex-1 rounded-xl overflow-hidden bg-stone-900 min-h-[380px]">
                <iframe
                  title="Localização da Igreja"
                  width="100%"
                  height="100%"
                  style={{ minHeight: '380px', border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={profile.contact.mapsEmbedUrl || `https://maps.google.com/maps?q=${encodeURIComponent(cleanAddress || profile.name)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                />
              </div>
              
              <div className="mt-3 flex items-center justify-between px-2 text-xs text-stone-400">
                <span>{cleanAddress}</span>
                <a
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                >
                  Ver rotas <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
