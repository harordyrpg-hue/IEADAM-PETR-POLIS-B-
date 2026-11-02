import React, { useState } from 'react';
import { ChurchAlbum, ChurchAlbumPhoto, ChurchAlbumVideo } from '../../types';
import { Image as ImageIcon, Video, Calendar, Eye, X, Play, ExternalLink } from 'lucide-react';

interface ChurchMediaGalleryProps {
  albums: ChurchAlbum[];
}

export const ChurchMediaGallery: React.FC<ChurchMediaGalleryProps> = ({ albums }) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'videos'>('photos');
  const [selectedPhoto, setSelectedPhoto] = useState<ChurchAlbumPhoto | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ChurchAlbumVideo | null>(null);
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string>('all');

  const filteredAlbums = selectedAlbumFilter === 'all'
    ? albums
    : albums.filter(a => a.id === selectedAlbumFilter);

  const allPhotos: { photo: ChurchAlbumPhoto; albumTitle: string }[] = [];
  const allVideos: { video: ChurchAlbumVideo; albumTitle: string }[] = [];

  filteredAlbums.forEach(album => {
    (album.photos || []).forEach(photo => {
      allPhotos.push({ photo, albumTitle: album.title });
    });
    (album.videos || []).forEach(video => {
      allVideos.push({ video, albumTitle: album.title });
    });
  });

  const getYoutubeEmbedUrl = (video: ChurchAlbumVideo) => {
    if (video.youtubeId) {
      return `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`;
    }
    const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
    const match = (video.youtubeUrl || '').match(regExp);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
    }
    return video.youtubeUrl;
  };

  return (
    <section id="galeria" className="py-20 bg-stone-900 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block text-amber-400 font-semibold text-sm tracking-wider uppercase bg-amber-950/60 border border-amber-800/60 px-3.5 py-1 rounded-full mb-3">
            Registros & Momentos
          </span>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-4">
            Galeria de Fotos e Vídeos
          </h2>
          <p className="text-stone-300 text-base sm:text-lg">
            Acompanhe em imagens e transmissões o que Deus tem realizado no meio da nossa comunidade.
          </p>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-stone-800/80 p-2 sm:p-3 rounded-2xl border border-stone-700/60">
          <div className="flex w-full sm:w-auto p-1 bg-stone-900/90 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveTab('photos')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'photos'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Fotos ({allPhotos.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'videos'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Vídeos ({allVideos.length})</span>
            </button>
          </div>

          {albums.length > 1 && (
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-xs text-stone-400 hidden sm:inline">Álbum:</span>
              <select
                value={selectedAlbumFilter}
                onChange={(e) => setSelectedAlbumFilter(e.target.value)}
                className="w-full sm:w-auto bg-stone-900 border border-stone-700 text-stone-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Álbuns</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Photos Grid */}
        {activeTab === 'photos' && (
          <div>
            {allPhotos.length === 0 ? (
              <div className="text-center py-16 bg-stone-850 rounded-2xl border border-stone-800 text-stone-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
                <p className="text-base font-medium">Nenhuma foto encontrada neste momento.</p>
                <p className="text-sm text-stone-400 mt-1">Nossos registros serão publicados em breve!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {allPhotos.map(({ photo, albumTitle }, idx) => (
                  <div
                    key={photo.id || idx}
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-stone-800 cursor-pointer shadow-md hover:shadow-xl transition-all duration-300 border border-stone-800 hover:border-amber-500/50"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption || albumTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end">
                      <p className="text-white text-xs font-semibold line-clamp-1">
                        {photo.caption || albumTitle}
                      </p>
                      <span className="text-amber-300 text-[11px] flex items-center gap-1 mt-0.5">
                        <Eye className="w-3 h-3" /> Ver em tamanho real
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Videos Grid */}
        {activeTab === 'videos' && (
          <div>
            {allVideos.length === 0 ? (
              <div className="text-center py-16 bg-stone-850 rounded-2xl border border-stone-800 text-stone-400">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-500" />
                <p className="text-base font-medium">Nenhum vídeo publicado ainda.</p>
                <p className="text-sm text-stone-400 mt-1">Transmissões e vídeos de cultos serão listados aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allVideos.map(({ video, albumTitle }, idx) => {
                  const yId = video.youtubeId || (video.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/) || [])[1];
                  const thumb = yId ? `https://img.youtube.com/vi/${yId}/hqdefault.jpg` : '';

                  return (
                    <div
                      key={video.id || idx}
                      className="group bg-stone-800/90 rounded-2xl overflow-hidden border border-stone-700/60 hover:border-amber-500/50 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
                    >
                      <div
                        onClick={() => setSelectedVideo(video)}
                        className="relative aspect-video bg-stone-900 cursor-pointer overflow-hidden"
                      >
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-stone-950 text-stone-600">
                            <Video className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-7 h-7 fill-white translate-x-0.5" />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-amber-400 mb-1 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{albumTitle}</span>
                          </div>
                          <h3 className="font-semibold text-white text-base line-clamp-2 mb-2 group-hover:text-amber-400 transition-colors">
                            {video.title}
                          </h3>
                        </div>

                        <div className="pt-3 border-t border-stone-700/60 flex items-center justify-between text-xs">
                          <button
                            onClick={() => setSelectedVideo(video)}
                            className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> Assistir
                          </button>
                          <a
                            href={video.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-400 hover:text-stone-200 flex items-center gap-1"
                          >
                            Abrir no YouTube <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Lightbox Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-stone-800 text-white hover:bg-stone-700 flex items-center justify-center shadow-lg transition-colors"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="max-w-5xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.caption || 'Foto'}
              className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            {selectedPhoto.caption && (
              <div className="mt-4 bg-stone-900/90 px-5 py-2.5 rounded-full border border-stone-800 text-center">
                <p className="text-stone-200 text-sm font-medium">{selectedPhoto.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Modal Player */}
      {selectedVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-stone-900 border border-stone-700/80 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <h3 className="font-semibold text-white text-base truncate pr-4">
                {selectedVideo.title}
              </h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="w-8 h-8 rounded-full bg-stone-800 text-stone-300 hover:text-white flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={getYoutubeEmbedUrl(selectedVideo)}
                title={selectedVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
