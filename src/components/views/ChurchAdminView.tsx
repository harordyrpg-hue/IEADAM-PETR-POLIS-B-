import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.js';
import { api } from '../../services/api';
import {
  ChurchProfile,
  ChurchAnnouncement,
  ChurchPublicEvent,
  ChurchArticle,
  ChurchAlbum,
  ChurchDownload,
  ChurchServiceSchedule,
  ChurchLeadershipMember,
  ChurchAlbumPhoto,
  ChurchAlbumVideo,
} from '../../types';
import {
  Church,
  Bell,
  Calendar,
  BookOpen,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Loader2,
  Pin,
  RefreshCw,
  X,
  MapPin,
  Video,
  Copy,
  Upload,
} from 'lucide-react';

type AdminChurchSubTab = 'profile' | 'announcements' | 'events' | 'articles' | 'gallery' | 'downloads';

export const ChurchAdminView: React.FC = () => {
  const { user } = useApp();
  const isSuperAdmin = user?.role === 'super_admin';
  const canManage = isSuperAdmin || user?.canManageChurchPage === true;

  const [activeSubTab, setActiveSubTab] = useState<AdminChurchSubTab>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Church Data State
  const [profile, setProfile] = useState<ChurchProfile>(api.getDefaultChurchProfile());
  const [announcements, setAnnouncements] = useState<ChurchAnnouncement[]>([]);
  const [events, setEvents] = useState<ChurchPublicEvent[]>([]);
  const [articles, setArticles] = useState<ChurchArticle[]>([]);
  const [albums, setAlbums] = useState<ChurchAlbum[]>([]);
  const [downloads, setDownloads] = useState<ChurchDownload[]>([]);

  // Modals & Active Edit States
  const [editingAnnouncement, setEditingAnnouncement] = useState<Partial<ChurchAnnouncement> | null>(null);
  const [editingEvent, setEditingEvent] = useState<Partial<ChurchPublicEvent> | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<ChurchArticle> | null>(null);
  const [editingAlbum, setEditingAlbum] = useState<Partial<ChurchAlbum> | null>(null);
  const [editingDownload, setEditingDownload] = useState<Partial<ChurchDownload> | null>(null);

  // New photo & video temp states for album editing
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');

  // Service Schedule edit state
  const [newServiceDay, setNewServiceDay] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceTime, setNewServiceTime] = useState('');

  // Leadership edit state
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderRole, setNewLeaderRole] = useState('');
  const [newLeaderPhoto, setNewLeaderPhoto] = useState('');

  // Image Upload State
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const handleFileUpload = async (file: File, target: 'logo' | 'hero' | 'announcement' | 'event' | 'article' | 'album_cover' | 'leader') => {
    try {
      setUploadingImage(target);
      const url = await api.uploadChurchImage(file, target);
      if (target === 'logo') {
        setProfile((prev) => ({ ...prev, logoUrl: url }));
        notifySuccess('Logo carregado com sucesso!');
      } else if (target === 'hero') {
        setProfile((prev) => ({ ...prev, heroBannerUrl: url }));
        notifySuccess('Banner Hero carregado com sucesso!');
      } else if (target === 'leader') {
        setNewLeaderPhoto(url);
        notifySuccess('Foto do líder carregada!');
      } else if (target === 'announcement') {
        setEditingAnnouncement((prev) => (prev ? { ...prev, imageUrl: url } : { imageUrl: url }));
        notifySuccess('Imagem do comunicado carregada!');
      } else if (target === 'event') {
        setEditingEvent((prev) => (prev ? { ...prev, bannerUrl: url } : { bannerUrl: url }));
        notifySuccess('Banner do evento carregado!');
      } else if (target === 'article') {
        setEditingArticle((prev) => (prev ? { ...prev, coverImageUrl: url } : { coverImageUrl: url }));
        notifySuccess('Capa do artigo carregada!');
      } else if (target === 'album_cover') {
        setEditingAlbum((prev) => (prev ? { ...prev, coverUrl: url } : { coverUrl: url }));
        notifySuccess('Capa do álbum carregada!');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao enviar imagem.');
    } finally {
      setUploadingImage(null);
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [p, ann, ev, art, alb, dl] = await Promise.all([
        api.getChurchProfile(),
        api.getChurchAnnouncements(false),
        api.getChurchPublicEvents(false),
        api.getChurchArticles(false),
        api.getChurchAlbums(false),
        api.getChurchDownloads(false),
      ]);
      setProfile(p);
      setAnnouncements(ann);
      setEvents(ev);
      setArticles(art);
      setAlbums(alb);
      setDownloads(dl);
    } catch (err) {
      console.error(err);
      setErrorMessage('Falha ao carregar dados da igreja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const notifySuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center bg-stone-900 rounded-2xl border border-stone-800 text-stone-300">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
        <p className="text-stone-400 max-w-md mx-auto">
          Você não possui permissão para gerenciar a página pública da igreja. Solicite acesso ao Administrador Geral da conta.
        </p>
      </div>
    );
  }

  // --- Profile Save Handler ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateChurchProfile(profile);
      notifySuccess('Dados e configurações da igreja atualizados com sucesso!');
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar dados da igreja');
    } finally {
      setSaving(false);
    }
  };

  // --- Announcement Handlers ---
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement?.title) return;
    try {
      setSaving(true);
      if (editingAnnouncement.id) {
        await api.updateChurchAnnouncement(editingAnnouncement.id, editingAnnouncement);
        notifySuccess('Comunicado atualizado!');
      } else {
        await api.createChurchAnnouncement({
          title: editingAnnouncement.title || '',
          content: editingAnnouncement.content || '',
          category: editingAnnouncement.category || 'Geral',
          date: editingAnnouncement.date || new Date().toISOString().split('T')[0],
          isPinned: !!editingAnnouncement.isPinned,
          status: editingAnnouncement.status || 'published',
          imageUrl: editingAnnouncement.imageUrl || null,
          authorName: user?.name || user?.email || 'Admin',
          authorUid: user?.uid || '',
        });
        notifySuccess('Comunicado publicado!');
      }
      setEditingAnnouncement(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar comunicado');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Deseja realmente excluir este comunicado?')) return;
    try {
      await api.deleteChurchAnnouncement(id);
      notifySuccess('Comunicado removido');
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Event Handlers ---
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent?.title) return;
    try {
      setSaving(true);
      if (editingEvent.id) {
        await api.updateChurchPublicEvent(editingEvent.id, editingEvent);
        notifySuccess('Evento atualizado!');
      } else {
        await api.createChurchPublicEvent({
          title: editingEvent.title || '',
          description: editingEvent.description || '',
          date: editingEvent.date || new Date().toISOString().split('T')[0],
          time: editingEvent.time || '19:30',
          location: editingEvent.location || 'Templo Principal',
          category: editingEvent.category || 'Conferência',
          status: editingEvent.status || 'published',
          bannerUrl: editingEvent.bannerUrl || null,
          authorName: user?.name || user?.email || 'Admin',
          authorUid: user?.uid || '',
        });
        notifySuccess('Evento criado com sucesso!');
      }
      setEditingEvent(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Deseja realmente excluir este evento?')) return;
    try {
      await api.deleteChurchPublicEvent(id);
      notifySuccess('Evento removido');
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Article Handlers ---
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle?.title) return;
    try {
      setSaving(true);
      if (editingArticle.id) {
        await api.updateChurchArticle(editingArticle.id, editingArticle);
        notifySuccess('Artigo / devocional atualizado!');
      } else {
        await api.createChurchArticle({
          title: editingArticle.title || '',
          summary: editingArticle.summary || '',
          content: editingArticle.content || '',
          author: editingArticle.author || user?.name || 'Pastor',
          category: editingArticle.category || 'Devocional',
          tags: editingArticle.tags || ['Palavra', 'Edificação'],
          coverImageUrl: editingArticle.coverImageUrl || null,
          status: editingArticle.status || 'published',
          publishedAt: editingArticle.publishedAt || new Date().toISOString().split('T')[0],
          authorUid: user?.uid || '',
        });
        notifySuccess('Artigo publicado com sucesso!');
      }
      setEditingArticle(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar artigo');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Deseja excluir este artigo?')) return;
    try {
      await api.deleteChurchArticle(id);
      notifySuccess('Artigo excluído');
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Album Handlers ---
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum?.title) return;
    try {
      setSaving(true);
      if (editingAlbum.id) {
        await api.updateChurchAlbum(editingAlbum.id, editingAlbum);
        notifySuccess('Álbum atualizado!');
      } else {
        await api.createChurchAlbum({
          title: editingAlbum.title || '',
          description: editingAlbum.description || '',
          date: editingAlbum.date || new Date().toISOString().split('T')[0],
          category: editingAlbum.category || 'Cultos',
          coverUrl: editingAlbum.coverUrl || 'https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=800&q=80',
          photos: editingAlbum.photos || [],
          videos: editingAlbum.videos || [],
          status: editingAlbum.status || 'published',
          authorName: user?.name || user?.email || 'Admin',
          authorUid: user?.uid || '',
        });
        notifySuccess('Álbum criado com sucesso!');
      }
      setEditingAlbum(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar álbum');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('Deseja excluir este álbum de fotos e vídeos?')) return;
    try {
      await api.deleteChurchAlbum(id);
      notifySuccess('Álbum excluído');
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // --- Download Handlers ---
  const handleSaveDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDownload?.title || !editingDownload?.fileUrl) return;
    try {
      setSaving(true);
      if (editingDownload.id) {
        await api.updateChurchDownload(editingDownload.id, editingDownload);
        notifySuccess('Arquivo para download atualizado!');
      } else {
        await api.createChurchDownload({
          title: editingDownload.title || '',
          description: editingDownload.description || '',
          category: (editingDownload.category as any) || 'boletim',
          fileUrl: editingDownload.fileUrl || '',
          fileSize: editingDownload.fileSize || 1024 * 500,
          format: editingDownload.format || 'pdf',
          status: editingDownload.status || 'published',
          authorName: user?.name || user?.email || 'Admin',
          authorUid: user?.uid || '',
        });
        notifySuccess('Material cadastrado para download!');
      }
      setEditingDownload(null);
      await loadAllData();
    } catch (err) {
      console.error(err);
      setErrorMessage('Erro ao salvar material para download');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDownload = async (id: string) => {
    if (!confirm('Deseja remover este arquivo de download?')) return;
    try {
      await api.deleteChurchDownload(id);
      notifySuccess('Material removido');
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header with Church info & Quick View Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/90 border border-stone-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Church className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              Gestão da Página da Igreja
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Pública: /?site ou #site
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
              Gerencie todo o conteúdo institucional, avisos, cultos, artigos e mídias visíveis aos visitantes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl transition-colors border border-stone-700 cursor-pointer"
            title="Recarregar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              window.open(`${window.location.origin}/?site`, '_blank');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm shadow-md shadow-amber-950/40 transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            <span>Ver Site da Igreja</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Public Link Sharing Box */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <ExternalLink className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-amber-300 block">Link Oficial para Divulgação da Igreja</span>
            <span className="text-xs text-stone-300 font-mono select-all truncate block">
              {typeof window !== 'undefined' ? `${window.location.origin}/?site` : '/?site'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/?site`;
              navigator.clipboard.writeText(url);
              notifySuccess('Link copiado! Envie pelo WhatsApp ou redes sociais.');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Link</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = '#site';
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium border border-stone-700 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizar Aqui</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-sm flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-stone-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Tabs Nav */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-stone-900 border border-stone-800 rounded-2xl scrollbar-none">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'profile'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <Church className="w-4 h-4" />
          <span>Dados & Institucional</span>
        </button>

        <button
          onClick={() => setActiveSubTab('announcements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'announcements'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Comunicados ({announcements.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('events')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'events'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda & Cultos ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('articles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'articles'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Artigos & Devocionais ({articles.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('gallery')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'gallery'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Álbuns & Vídeos ({albums.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('downloads')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
            activeSubTab === 'downloads'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Downloads ({downloads.length})</span>
        </button>
      </div>

      {/* Tab 1: Profile & Institutional Data */}
      {activeSubTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-stone-800 pb-3 flex items-center gap-2">
              <Church className="w-5 h-5 text-amber-500" /> Informações Principais
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Nome da Igreja *</label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Mensagem de Boas-vindas</label>
                <input
                  type="text"
                  value={profile.welcomeMessage || ''}
                  onChange={(e) => setProfile({ ...profile, welcomeMessage: e.target.value })}
                  placeholder="Seja muito bem-vindo!"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Slogan / Frase de Apresentação</label>
                <input
                  type="text"
                  value={profile.slogan || ''}
                  onChange={(e) => setProfile({ ...profile, slogan: e.target.value })}
                  placeholder="Ex: Uma igreja família, acolhendo vidas e pregando a verdade de Cristo."
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Versículo em Destaque (Texto)</label>
                <input
                  type="text"
                  value={profile.highlightVerse?.text || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      highlightVerse: {
                        ...profile.highlightVerse,
                        text: e.target.value,
                        reference: profile.highlightVerse?.reference || '',
                      },
                    })
                  }
                  placeholder="Vinde a mim todos os cansados..."
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Referência Bíblica</label>
                <input
                  type="text"
                  value={profile.highlightVerse?.reference || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      highlightVerse: {
                        text: profile.highlightVerse?.text || '',
                        reference: e.target.value,
                      },
                    })
                  }
                  placeholder="Mateus 11:28"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-1 space-y-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Logotipo da Igreja</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-stone-850 border border-stone-700 flex items-center justify-center overflow-hidden shrink-0">
                    {profile.logoUrl ? (
                      <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Church className="w-6 h-6 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-all">
                      {uploadingImage === 'logo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingImage === 'logo' ? 'Enviando...' : 'Fazer Upload do Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')}
                      />
                    </label>
                    <input
                      type="url"
                      value={profile.logoUrl || ''}
                      onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                      placeholder="Ou cole a URL do logo..."
                      className="w-full bg-stone-850 border border-stone-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Banner Principal do Topo (Hero)</label>
                <div className="space-y-3">
                  {profile.heroBannerUrl && (
                    <div className="w-full h-36 rounded-xl overflow-hidden border border-stone-700 relative group">
                      <img src={profile.heroBannerUrl} alt="Banner Hero" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="text-xs text-white font-medium">Banner Ativo do Site</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer transition-all shrink-0">
                      {uploadingImage === 'hero' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>{uploadingImage === 'hero' ? 'Enviando foto...' : 'Fazer Upload do Banner (Celular/PC)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'hero')}
                      />
                    </label>

                    <input
                      type="url"
                      value={profile.heroBannerUrl || ''}
                      onChange={(e) => setProfile({ ...profile, heroBannerUrl: e.target.value })}
                      placeholder="Ou cole o link direto da imagem aqui..."
                      className="flex-1 bg-stone-850 border border-stone-700 text-white text-xs rounded-xl px-3 py-2.5 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Curated Presets */}
                  <div>
                    <span className="text-[11px] text-stone-400 block mb-1.5">Sugestões de Banners em Alta Definição:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Templo & Altar', url: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1600&q=80' },
                        { label: 'Louvor & Adoração', url: 'https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=1600&q=80' },
                        { label: 'Comunhão & Família', url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80' },
                        { label: 'Bíblia & Oração', url: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1600&q=80' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setProfile((prev) => ({ ...prev, heroBannerUrl: preset.url }));
                            notifySuccess(`Banner "${preset.label}" selecionado!`);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 hover:text-white text-[11px] font-medium text-left truncate transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* About, History, Mission, Vision */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-stone-800 pb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" /> Sobre a Igreja (História, Missão e Visão)
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">História da Igreja</label>
                <textarea
                  rows={4}
                  value={profile.history || ''}
                  onChange={(e) => setProfile({ ...profile, history: e.target.value })}
                  placeholder="Conte um pouco sobre como a igreja começou e sua caminhada até hoje..."
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-3 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Missão</label>
                  <textarea
                    rows={3}
                    value={profile.mission || ''}
                    onChange={(e) => setProfile({ ...profile, mission: e.target.value })}
                    placeholder="Qual é a missão da igreja..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-3 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Visão</label>
                  <textarea
                    rows={3}
                    value={profile.vision || ''}
                    onChange={(e) => setProfile({ ...profile, vision: e.target.value })}
                    placeholder="Onde a igreja deseja chegar nos próximos anos..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-3 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Regular Schedules & Leadership Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Regular Services */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
              <h4 className="text-base font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" /> Grade Semanal de Cultos
              </h4>
              
              <div className="space-y-2">
                {(profile.serviceTimes || []).map((sch, i) => (
                  <div key={sch.id || i} className="flex items-center justify-between p-3 bg-stone-850 rounded-xl border border-stone-800 text-xs">
                    <div>
                      <span className="font-semibold text-amber-400 block">{sch.day} às {sch.time}</span>
                      <span className="text-stone-300">{sch.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (profile.serviceTimes || []).filter((_, idx) => idx !== i);
                        setProfile({ ...profile, serviceTimes: updated });
                      }}
                      className="text-stone-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Service Inline */}
              <div className="pt-2 border-t border-stone-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Dia (ex: Domingo)"
                    value={newServiceDay}
                    onChange={(e) => setNewServiceDay(e.target.value)}
                    className="bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                  />
                  <input
                    type="text"
                    placeholder="Horário (ex: 19h00)"
                    value={newServiceTime}
                    onChange={(e) => setNewServiceTime(e.target.value)}
                    className="bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Nome (ex: Culto de Celebração)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newServiceDay || !newServiceName || !newServiceTime) return;
                    const item: ChurchServiceSchedule = {
                      id: 'sch_' + Date.now(),
                      day: newServiceDay,
                      title: newServiceName,
                      time: newServiceTime,
                    };
                    setProfile({
                      ...profile,
                      serviceTimes: [...(profile.serviceTimes || []), item],
                    });
                    setNewServiceDay('');
                    setNewServiceName('');
                    setNewServiceTime('');
                  }}
                  className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Culto à Grade
                </button>
              </div>
            </div>

            {/* Leadership */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
              <h4 className="text-base font-semibold text-white flex items-center gap-2">
                <Church className="w-4 h-4 text-amber-500" /> Membros da Liderança
              </h4>

              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(profile.leadership || []).map((lead, i) => (
                  <div key={lead.id || i} className="flex items-center justify-between p-3 bg-stone-850 rounded-xl border border-stone-800 text-xs">
                    <div className="flex items-center gap-3">
                      {lead.photoUrl ? (
                        <img src={lead.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center font-bold text-stone-300">
                          {lead.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-white block">{lead.name}</span>
                        <span className="text-amber-400">{lead.role}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (profile.leadership || []).filter((_, idx) => idx !== i);
                        setProfile({ ...profile, leadership: updated });
                      }}
                      className="text-stone-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Leader Inline */}
              <div className="pt-2 border-t border-stone-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={newLeaderName}
                    onChange={(e) => setNewLeaderName(e.target.value)}
                    className="bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                  />
                  <input
                    type="text"
                    placeholder="Cargo (ex: Pastor Titular)"
                    value={newLeaderRole}
                    onChange={(e) => setNewLeaderRole(e.target.value)}
                    className="bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer shrink-0">
                    {uploadingImage === 'leader' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{uploadingImage === 'leader' ? 'Enviando...' : 'Subir Foto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'leader')}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="Ou cole a URL da Foto do Líder"
                    value={newLeaderPhoto}
                    onChange={(e) => setNewLeaderPhoto(e.target.value)}
                    className="flex-1 bg-stone-850 border border-stone-700 text-white text-xs rounded-lg p-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newLeaderName || !newLeaderRole) return;
                    const item: ChurchLeadershipMember = {
                      id: 'lead_' + Date.now(),
                      name: newLeaderName,
                      role: newLeaderRole,
                      photoUrl: newLeaderPhoto || undefined,
                    };
                    setProfile({
                      ...profile,
                      leadership: [...(profile.leadership || []), item],
                    });
                    setNewLeaderName('');
                    setNewLeaderRole('');
                    setNewLeaderPhoto('');
                  }}
                  className="w-full py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar à Liderança
                </button>
              </div>
            </div>
          </div>

          {/* Contact and Social Networks */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white border-b border-stone-800 pb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-500" /> Contato, Localização & Redes
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-300 mb-1">Endereço (Rua, Número, Bairro)</label>
                <input
                  type="text"
                  value={profile.contact.address || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, address: e.target.value },
                    })
                  }
                  placeholder="Ex: Av. Central, 1200 - Centro"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Cidade / Estado / CEP</label>
                <input
                  type="text"
                  value={profile.contact.cityState || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, cityState: e.target.value },
                    })
                  }
                  placeholder="São Paulo - SP, CEP 01000-000"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Telefone Fixo</label>
                <input
                  type="text"
                  value={profile.contact.phone || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, phone: e.target.value },
                    })
                  }
                  placeholder="(11) 3333-0000"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={profile.contact.whatsapp || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, whatsapp: e.target.value },
                    })
                  }
                  placeholder="(11) 99999-9999"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={profile.contact.email || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, email: e.target.value },
                    })
                  }
                  placeholder="contato@igreja.com.br"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-stone-300 mb-1">Link de Compartilhamento do Google Maps</label>
                <input
                  type="url"
                  value={profile.contact.mapsLink || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      contact: { ...profile.contact, mapsLink: e.target.value },
                    })
                  }
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Instagram (@ ou URL)</label>
                <input
                  type="text"
                  value={profile.social?.instagram || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      social: { ...profile.social, instagram: e.target.value },
                    })
                  }
                  placeholder="@suaigreja"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Canal do YouTube</label>
                <input
                  type="text"
                  value={profile.social?.youtube || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      social: { ...profile.social, youtube: e.target.value },
                    })
                  }
                  placeholder="URL ou @canal"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">Facebook</label>
                <input
                  type="text"
                  value={profile.social?.facebook || ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      social: { ...profile.social, facebook: e.target.value },
                    })
                  }
                  placeholder="URL ou página"
                  className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl px-3.5 py-2.5 focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm shadow-lg shadow-amber-950/50 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Salvar Alterações Institucionais</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Announcements */}
      {activeSubTab === 'announcements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <div>
              <h3 className="font-semibold text-white">Quadro de Avisos & Comunicados</h3>
              <p className="text-xs text-stone-400">Notícias e comunicados exibidos no mural da igreja.</p>
            </div>
            <button
              onClick={() =>
                setEditingAnnouncement({
                  title: '',
                  category: 'Geral',
                  status: 'published',
                  isPinned: false,
                  date: new Date().toISOString().split('T')[0],
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" /> Novo Comunicado
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between hover:border-stone-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 font-medium">
                      {ann.category || 'Geral'}
                    </span>
                    <div className="flex items-center gap-2">
                      {ann.isPinned && (
                        <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Pin className="w-3 h-3" /> Fixo
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          ann.status === 'published'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {ann.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-semibold text-white text-base mb-1">{ann.title}</h4>
                  <p className="text-xs text-stone-400 line-clamp-3 mb-4">{ann.content}</p>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
                  <span>{ann.date} • {ann.authorName || 'Autor'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingAnnouncement(ann)}
                      className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Announcement Form */}
          {editingAnnouncement && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveAnnouncement}
                className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <h3 className="font-semibold text-white text-base">
                    {editingAnnouncement.id ? 'Editar Comunicado' : 'Novo Comunicado'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncement(null)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Título do Comunicado *</label>
                  <input
                    type="text"
                    required
                    value={editingAnnouncement.title || ''}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Categoria</label>
                    <input
                      type="text"
                      value={editingAnnouncement.category || ''}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, category: e.target.value })}
                      placeholder="Ex: Geral, Jovens, Missões"
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Data</label>
                    <input
                      type="date"
                      value={editingAnnouncement.date || ''}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, date: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Conteúdo do Aviso</label>
                  <textarea
                    rows={4}
                    value={editingAnnouncement.content || ''}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })}
                    placeholder="Mensagem do aviso..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Imagem / Cartaz do Aviso</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer shrink-0">
                      {uploadingImage === 'announcement' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingImage === 'announcement' ? 'Enviando...' : 'Subir Imagem'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'announcement')}
                      />
                    </label>
                    <input
                      type="url"
                      value={editingAnnouncement.imageUrl || ''}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, imageUrl: e.target.value })}
                      placeholder="Ou cole a URL da imagem/cartaz..."
                      className="flex-1 bg-stone-850 border border-stone-700 text-white text-xs rounded-xl p-2.5"
                    />
                  </div>
                  {editingAnnouncement.imageUrl && (
                    <div className="mt-2 h-24 rounded-lg overflow-hidden border border-stone-700">
                      <img src={editingAnnouncement.imageUrl} alt="Prévia" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Status</label>
                    <select
                      value={editingAnnouncement.status || 'published'}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, status: e.target.value as any })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="published">Publicado</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isPinned"
                      checked={editingAnnouncement.isPinned || false}
                      onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, isPinned: e.target.checked })}
                      className="rounded border-stone-700 bg-stone-850 text-amber-500 w-4 h-4"
                    />
                    <label htmlFor="isPinned" className="text-xs text-stone-300 cursor-pointer">
                      Fixar no topo do mural
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setEditingAnnouncement(null)}
                    className="px-4 py-2 rounded-xl bg-stone-850 text-stone-300 text-xs hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    {saving ? 'Salvando...' : 'Salvar Comunicado'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Events & Schedules */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <div>
              <h3 className="font-semibold text-white">Agenda & Calendário de Eventos</h3>
              <p className="text-xs text-stone-400">Eventos especiais, conferências, retiros e cultos comemorativos.</p>
            </div>
            <button
              onClick={() =>
                setEditingEvent({
                  title: '',
                  category: 'Conferência',
                  status: 'published',
                  date: new Date().toISOString().split('T')[0],
                  time: '19:30',
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" /> Novo Evento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <div
                key={ev.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between hover:border-stone-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 font-medium">
                      {ev.category}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        ev.status === 'published'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {ev.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base mb-1">{ev.title}</h4>
                  <p className="text-xs text-stone-400 line-clamp-2 mb-3">{ev.description}</p>
                  
                  <div className="text-xs text-stone-300 space-y-1 bg-stone-850 p-2.5 rounded-xl border border-stone-800">
                    <div>Data: <strong className="text-white">{ev.date}</strong> às <strong className="text-amber-400">{ev.time}</strong></div>
                    {ev.location && <div>Local: <span className="text-stone-300">{ev.location}</span></div>}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 mt-4">
                  <span>Por {ev.authorName || 'Igreja'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingEvent(ev)}
                      className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Event Form */}
          {editingEvent && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveEvent}
                className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <h3 className="font-semibold text-white text-base">
                    {editingEvent.id ? 'Editar Evento' : 'Novo Evento na Agenda'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Título do Evento *</label>
                  <input
                    type="text"
                    required
                    value={editingEvent.title || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Data *</label>
                    <input
                      type="date"
                      required
                      value={editingEvent.date || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Horário *</label>
                    <input
                      type="text"
                      required
                      placeholder="19:30"
                      value={editingEvent.time || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Categoria</label>
                    <select
                      value={editingEvent.category || 'Conferência'}
                      onChange={(e) => setEditingEvent({ ...editingEvent, category: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="Conferência">Conferência</option>
                      <option value="Vigília">Vigília</option>
                      <option value="Retiro">Retiro</option>
                      <option value="Evangelismo">Evangelismo</option>
                      <option value="Culto Especial">Culto Especial</option>
                      <option value="Comunhão">Comunhão / Almoço</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Local</label>
                    <input
                      type="text"
                      placeholder="Templo Principal"
                      value={editingEvent.location || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Descrição do Evento</label>
                  <textarea
                    rows={3}
                    value={editingEvent.description || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Banner / Imagem do Evento</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer shrink-0">
                      {uploadingImage === 'event' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingImage === 'event' ? 'Enviando...' : 'Subir Banner'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'event')}
                      />
                    </label>
                    <input
                      type="url"
                      value={editingEvent.bannerUrl || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, bannerUrl: e.target.value })}
                      placeholder="Ou cole a URL do banner..."
                      className="flex-1 bg-stone-850 border border-stone-700 text-white text-xs rounded-xl p-2.5"
                    />
                  </div>
                  {editingEvent.bannerUrl && (
                    <div className="mt-2 h-24 rounded-lg overflow-hidden border border-stone-700">
                      <img src={editingEvent.bannerUrl} alt="Prévia" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Status</label>
                  <select
                    value={editingEvent.status || 'published'}
                    onChange={(e) => setEditingEvent({ ...editingEvent, status: e.target.value as any })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Rascunho</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="px-4 py-2 rounded-xl bg-stone-850 text-stone-300 text-xs hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    {saving ? 'Salvando...' : 'Salvar Evento'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Articles & Devotionals */}
      {activeSubTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <div>
              <h3 className="font-semibold text-white">Artigos, Devocionais & Estudos</h3>
              <p className="text-xs text-stone-400">Mensagens pastorais e textos para leitura e edificação da comunidade.</p>
            </div>
            <button
              onClick={() =>
                setEditingArticle({
                  title: '',
                  category: 'Devocional',
                  status: 'published',
                  author: user?.name || 'Pastor',
                  publishedAt: new Date().toISOString().split('T')[0],
                  content: '',
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" /> Novo Artigo / Devocional
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((art) => (
              <div
                key={art.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between hover:border-stone-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 font-medium">
                      {art.category}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        art.status === 'published'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {art.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base mb-1">{art.title}</h4>
                  <p className="text-xs text-stone-400 line-clamp-3 mb-3">{art.summary || art.content}</p>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
                  <span>{art.author} • {art.publishedAt}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingArticle(art)}
                      className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(art.id)}
                      className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Article Form */}
          {editingArticle && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveArticle}
                className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <h3 className="font-semibold text-white text-base">
                    {editingArticle.id ? 'Editar Artigo' : 'Novo Artigo / Devocional'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingArticle(null)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Título do Artigo *</label>
                  <input
                    type="text"
                    required
                    value={editingArticle.title || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Categoria</label>
                    <select
                      value={editingArticle.category || 'Devocional'}
                      onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="Devocional">Devocional</option>
                      <option value="Estudo Bíblico">Estudo Bíblico</option>
                      <option value="Palavra Pastoral">Palavra Pastoral</option>
                      <option value="Família">Família</option>
                      <option value="Missões">Missões</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Autor</label>
                    <input
                      type="text"
                      value={editingArticle.author || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Status</label>
                    <select
                      value={editingArticle.status || 'published'}
                      onChange={(e) => setEditingArticle({ ...editingArticle, status: e.target.value as any })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="published">Publicado</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Breve Resumo (chamada para a listagem)</label>
                  <input
                    type="text"
                    value={editingArticle.summary || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, summary: e.target.value })}
                    placeholder="Resumo de 1 ou 2 frases sobre a mensagem..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Imagem de Capa do Artigo / Devocional</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer shrink-0">
                      {uploadingImage === 'article' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingImage === 'article' ? 'Enviando...' : 'Subir Imagem'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'article')}
                      />
                    </label>
                    <input
                      type="url"
                      value={editingArticle.coverImageUrl || ''}
                      onChange={(e) => setEditingArticle({ ...editingArticle, coverImageUrl: e.target.value })}
                      placeholder="Ou cole a URL da imagem de capa..."
                      className="flex-1 bg-stone-850 border border-stone-700 text-white text-xs rounded-xl p-2.5"
                    />
                  </div>
                  {editingArticle.coverImageUrl && (
                    <div className="mt-2 h-24 rounded-lg overflow-hidden border border-stone-700">
                      <img src={editingArticle.coverImageUrl} alt="Prévia" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">
                    Conteúdo Completo (Suporta formatação com títulos ##, listas e parágrafos) *
                  </label>
                  <textarea
                    rows={10}
                    required
                    value={editingArticle.content || ''}
                    onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                    placeholder="Escreva a mensagem aqui..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-3 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setEditingArticle(null)}
                    className="px-4 py-2 rounded-xl bg-stone-850 text-stone-300 text-xs hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    {saving ? 'Salvando...' : 'Salvar Artigo'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Gallery (Albums, Photos & Videos) */}
      {activeSubTab === 'gallery' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <div>
              <h3 className="font-semibold text-white">Álbuns de Fotos e Transmissões / Vídeos</h3>
              <p className="text-xs text-stone-400">Crie álbuns temáticos, adicione fotos e links de vídeos do YouTube.</p>
            </div>
            <button
              onClick={() =>
                setEditingAlbum({
                  title: '',
                  description: '',
                  status: 'published',
                  date: new Date().toISOString().split('T')[0],
                  photos: [],
                  videos: [],
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" /> Novo Álbum
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {albums.map((alb) => (
              <div
                key={alb.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between hover:border-stone-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-300 font-medium">
                      {(alb.photos || []).length} fotos • {(alb.videos || []).length} vídeos
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        alb.status === 'published'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {alb.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base mb-1">{alb.title}</h4>
                  <p className="text-xs text-stone-400 line-clamp-2 mb-3">{alb.description}</p>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
                  <span>{alb.date}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingAlbum(alb)}
                      className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg"
                      title="Gerenciar Fotos e Vídeos"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAlbum(alb.id)}
                      className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg"
                      title="Excluir Álbum"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Album Form */}
          {editingAlbum && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveAlbum}
                className="bg-stone-900 border border-stone-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <h3 className="font-semibold text-white text-base">
                    {editingAlbum.id ? 'Gerenciar Álbum' : 'Criar Novo Álbum'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingAlbum(null)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-stone-300 mb-1">Título do Álbum *</label>
                    <input
                      type="text"
                      required
                      value={editingAlbum.title || ''}
                      onChange={(e) => setEditingAlbum({ ...editingAlbum, title: e.target.value })}
                      placeholder="Ex: Culto de Aniversário 2026"
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Data</label>
                    <input
                      type="date"
                      value={editingAlbum.date || ''}
                      onChange={(e) => setEditingAlbum({ ...editingAlbum, date: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Status</label>
                    <select
                      value={editingAlbum.status || 'published'}
                      onChange={(e) => setEditingAlbum({ ...editingAlbum, status: e.target.value as any })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="published">Publicado</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={editingAlbum.description || ''}
                    onChange={(e) => setEditingAlbum({ ...editingAlbum, description: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                {/* Sub-section: Photos in album */}
                <div className="p-4 bg-stone-850 rounded-xl border border-stone-800 space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-amber-500" /> Fotos no Álbum ({(editingAlbum.photos || []).length})
                    </span>
                  </h4>

                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer shrink-0">
                        {uploadingImage === 'album_photo' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        <span>{uploadingImage === 'album_photo' ? 'Enviando...' : 'Subir Foto'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            try {
                              setUploadingImage('album_photo');
                              const url = await api.uploadChurchImage(f, 'album');
                              setNewPhotoUrl(url);
                              notifySuccess('Foto enviada!');
                            } finally {
                              setUploadingImage(null);
                            }
                          }}
                        />
                      </label>
                      <input
                        type="url"
                        placeholder="Ou cole a URL da Imagem"
                        value={newPhotoUrl}
                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                        className="flex-1 bg-stone-900 border border-stone-700 text-white text-xs rounded-lg p-2"
                      />
                      <input
                        type="text"
                        placeholder="Legenda da foto (opcional)"
                        value={newPhotoCaption}
                        onChange={(e) => setNewPhotoCaption(e.target.value)}
                        className="sm:w-48 bg-stone-900 border border-stone-700 text-white text-xs rounded-lg p-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPhotoUrl) return;
                        const p: ChurchAlbumPhoto = {
                          id: 'ph_' + Date.now(),
                          url: newPhotoUrl,
                          caption: newPhotoCaption || undefined,
                        };
                        setEditingAlbum({
                          ...editingAlbum,
                          photos: [...(editingAlbum.photos || []), p],
                          coverUrl: editingAlbum.coverUrl || newPhotoUrl,
                        });
                        setNewPhotoUrl('');
                        setNewPhotoCaption('');
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Foto
                    </button>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto pt-2">
                    {(editingAlbum.photos || []).map((ph, idx) => (
                      <div key={ph.id || idx} className="relative group aspect-square rounded-lg overflow-hidden bg-stone-900 border border-stone-750">
                        <img src={ph.url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingAlbum.photos || []).filter((_, i) => i !== idx);
                            setEditingAlbum({ ...editingAlbum, photos: updated });
                          }}
                          className="absolute top-1 right-1 bg-red-600/90 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub-section: YouTube Videos in album */}
                <div className="p-4 bg-stone-850 rounded-xl border border-stone-800 space-y-3">
                  <h4 className="text-sm font-semibold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-red-500" /> Vídeos do YouTube ({(editingAlbum.videos || []).length})
                    </span>
                  </h4>

                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Título do vídeo"
                        value={newVideoTitle}
                        onChange={(e) => setNewVideoTitle(e.target.value)}
                        className="bg-stone-900 border border-stone-700 text-white text-xs rounded-lg p-2"
                      />
                      <input
                        type="url"
                        placeholder="Link do YouTube (ex: https://youtu.be/...)"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        className="bg-stone-900 border border-stone-700 text-white text-xs rounded-lg p-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newVideoTitle || !newVideoUrl) return;
                        const match = newVideoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
                        const v: ChurchAlbumVideo = {
                          id: 'vid_' + Date.now(),
                          title: newVideoTitle,
                          youtubeUrl: newVideoUrl,
                          youtubeId: match && match[1] ? match[1] : '',
                        };
                        setEditingAlbum({
                          ...editingAlbum,
                          videos: [...(editingAlbum.videos || []), v],
                        });
                        setNewVideoTitle('');
                        setNewVideoUrl('');
                      }}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Vídeo
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-32 overflow-y-auto pt-2">
                    {(editingAlbum.videos || []).map((vd, idx) => (
                      <div key={vd.id || idx} className="flex items-center justify-between bg-stone-900 p-2 rounded-lg text-xs">
                        <span className="text-stone-200 truncate max-w-xs">{vd.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingAlbum.videos || []).filter((_, i) => i !== idx);
                            setEditingAlbum({ ...editingAlbum, videos: updated });
                          }}
                          className="text-stone-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setEditingAlbum(null)}
                    className="px-4 py-2 rounded-xl bg-stone-850 text-stone-300 text-xs hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    {saving ? 'Salvando...' : 'Salvar Álbum'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Public Downloads */}
      {activeSubTab === 'downloads' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-stone-900 border border-stone-800 p-4 rounded-2xl">
            <div>
              <h3 className="font-semibold text-white">Arquivos para Download Público</h3>
              <p className="text-xs text-stone-400">Boletins semanais, devocionais em PDF, estudos bíblicos e partituras.</p>
            </div>
            <button
              onClick={() =>
                setEditingDownload({
                  title: '',
                  category: 'boletim',
                  format: 'pdf',
                  status: 'published',
                  fileUrl: '',
                  fileSize: 1024 * 300,
                  downloadCount: 0,
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md"
            >
              <Plus className="w-4 h-4" /> Novo Arquivo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {downloads.map((item) => (
              <div
                key={item.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col justify-between hover:border-stone-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 font-medium">
                      {item.category}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                        item.status === 'published'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {item.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base mb-1">{item.title}</h4>
                  <p className="text-xs text-stone-400 line-clamp-2 mb-3">{item.description}</p>
                </div>

                <div className="pt-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
                  <span>{item.format?.toUpperCase()} • {item.downloadCount || 0} downloads</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingDownload(item)}
                      className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteDownload(item.id)}
                      className="p-1.5 text-stone-400 hover:text-red-400 hover:bg-stone-800 rounded-lg"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Modal Download Form */}
          {editingDownload && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveDownload}
                className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
              >
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <h3 className="font-semibold text-white text-base">
                    {editingDownload.id ? 'Editar Arquivo de Download' : 'Novo Arquivo para Download'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingDownload(null)}
                    className="text-stone-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Título do Documento *</label>
                  <input
                    type="text"
                    required
                    value={editingDownload.title || ''}
                    onChange={(e) => setEditingDownload({ ...editingDownload, title: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Categoria</label>
                    <select
                      value={editingDownload.category || 'boletim'}
                      onChange={(e) => setEditingDownload({ ...editingDownload, category: e.target.value as any })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    >
                      <option value="boletim">Boletim Semanal</option>
                      <option value="estudo">Estudo Bíblico</option>
                      <option value="partitura">Partitura / Cifra</option>
                      <option value="leitura">Guia de Leitura / Oração</option>
                      <option value="outro">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-stone-300 mb-1">Formato</label>
                    <input
                      type="text"
                      placeholder="pdf, docx, mp3..."
                      value={editingDownload.format || 'pdf'}
                      onChange={(e) => setEditingDownload({ ...editingDownload, format: e.target.value })}
                      className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">URL do Arquivo *</label>
                  <input
                    type="url"
                    required
                    value={editingDownload.fileUrl || ''}
                    onChange={(e) => setEditingDownload({ ...editingDownload, fileUrl: e.target.value })}
                    placeholder="https://... ou /uploads/..."
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Descrição</label>
                  <textarea
                    rows={2}
                    value={editingDownload.description || ''}
                    onChange={(e) => setEditingDownload({ ...editingDownload, description: e.target.value })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">Status</label>
                  <select
                    value={editingDownload.status || 'published'}
                    onChange={(e) => setEditingDownload({ ...editingDownload, status: e.target.value as any })}
                    className="w-full bg-stone-850 border border-stone-700 text-white text-sm rounded-xl p-2.5"
                  >
                    <option value="published">Publicado</option>
                    <option value="draft">Rascunho</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => setEditingDownload(null)}
                    className="px-4 py-2 rounded-xl bg-stone-850 text-stone-300 text-xs hover:bg-stone-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
                  >
                    {saving ? 'Salvando...' : 'Salvar Arquivo'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
