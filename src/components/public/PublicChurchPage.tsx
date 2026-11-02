import React, { useEffect, useState } from 'react';
import {
  ChurchProfile,
  ChurchAnnouncement,
  ChurchPublicEvent,
  ChurchArticle,
  ChurchAlbum,
  ChurchDownload,
} from '../../types';
import { api } from '../../services/api';
import { ChurchPublicNavbar } from './ChurchPublicNavbar';
import { ChurchHero } from './ChurchHero';
import { ChurchAbout } from './ChurchAbout';
import { ChurchAnnouncements } from './ChurchAnnouncements';
import { ChurchSchedule } from './ChurchSchedule';
import { ChurchDevotionals } from './ChurchDevotionals';
import { ChurchMediaGallery } from './ChurchMediaGallery';
import { ChurchDownloads } from './ChurchDownloads';
import { ChurchContact } from './ChurchContact';
import { ChurchPublicFooter } from './ChurchPublicFooter';
import { Church, Loader2 } from 'lucide-react';

export const PublicChurchPage: React.FC = () => {
  const [profile, setProfile] = useState<ChurchProfile>(api.getDefaultChurchProfile());
  const [announcements, setAnnouncements] = useState<ChurchAnnouncement[]>([]);
  const [events, setEvents] = useState<ChurchPublicEvent[]>([]);
  const [articles, setArticles] = useState<ChurchArticle[]>([]);
  const [albums, setAlbums] = useState<ChurchAlbum[]>([]);
  const [downloads, setDownloads] = useState<ChurchDownload[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const loadChurchPublicData = async () => {
      try {
        setLoading(true);

        // Seed default initial data if Firestore is empty
        try {
          await api.seedInitialChurchDataIfEmpty();
        } catch {
          // If seeding is skipped or rules prevent write, continue with existing data
        }

        const [
          profileData,
          announcementsData,
          eventsData,
          articlesData,
          albumsData,
          downloadsData,
        ] = await Promise.all([
          api.getChurchProfile(),
          api.getChurchAnnouncements(true),
          api.getChurchPublicEvents(true),
          api.getChurchArticles(true),
          api.getChurchAlbums(true),
          api.getChurchDownloads(true),
        ]);

        if (isMounted) {
          setProfile(profileData);
          setAnnouncements(announcementsData);
          setEvents(eventsData);
          setArticles(articlesData);
          setAlbums(albumsData);
          setDownloads(downloadsData);
        }
      } catch (err) {
        console.error('Erro ao carregar dados da igreja:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadChurchPublicData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-300">
        <div className="w-16 h-16 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4 animate-pulse">
          <Church className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-3 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span className="text-base font-serif">Carregando portal da igreja...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-600 selection:text-white">
      {/* Public Navigation */}
      <ChurchPublicNavbar profile={profile} />

      <main className="flex-1">
        {/* Hero Section */}
        <ChurchHero profile={profile} />

        {/* Announcements Mural */}
        <ChurchAnnouncements announcements={announcements} />

        {/* About the Church */}
        <ChurchAbout profile={profile} />

        {/* Schedules & Events */}
        <ChurchSchedule profile={profile} events={events} />

        {/* Devotionals & Articles */}
        <ChurchDevotionals articles={articles} />

        {/* Media Gallery (Photos & YouTube Videos) */}
        <ChurchMediaGallery albums={albums} />

        {/* Downloads & Bulletins */}
        <ChurchDownloads downloads={downloads} />

        {/* Contact & Map */}
        <ChurchContact profile={profile} />
      </main>

      {/* Public Footer */}
      <ChurchPublicFooter profile={profile} />
    </div>
  );
};
