export type UserRole = 'super_admin' | 'media_admin' | 'media_member';

export interface User {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  avatar: string;
  status: 'active' | 'blocked';
  canManageChurchPage?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  ownerUid: string;
  isFavorite: boolean;
  inTrash: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MediaCategory = 'photo' | 'video' | 'art' | 'audio' | 'document' | 'archive' | 'other';

export interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  type: MediaCategory;
  storagePath: string; // Cloud Storage path
  storageKey?: string; // Compatibility alias
  downloadUrl: string; // Cloud Storage download URL
  thumbnailUrl: string | null;
  folderId: string | null;
  eventId: string | null;
  ownerUid: string;
  ownerName: string;
  userName?: string; // Compatibility alias
  isFavorite: boolean;
  inTrash: boolean;
  trashedAt: string | null;
  tags: string[];
  resolution: string | null;
  duration: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchEvent {
  id: string;
  name: string;
  description: string;
  date: string;
  category: string;
  coverUrl: string;
  responsibles: string[];
  ownerUid: string;
  createdAt: string;
  updatedAt?: string;
  stats?: {
    totalFiles: number;
    photos: number;
    videos: number;
    arts: number;
    audios: number;
    docs: number;
    totalBytes: number;
  };
}

export interface ShareLink {
  id: string;
  token: string;
  resourceType: 'file' | 'folder' | 'event';
  resourceId: string;
  resourceName: string;
  allowDownload: boolean;
  requireAuth: boolean;
  expiresAt: string | null;
  ownerUid: string;
  createdByName: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  actionLabel: string;
  targetType: string;
  targetName: string;
  details: string;
  createdAt: string;
}

export interface StorageStats {
  totalBytesUsed: number;
  totalQuota: number;
  availableBytes: number;
  usedPercentage: number;
  breakdown: {
    photos: { bytes: number; count: number };
    videos: { bytes: number; count: number };
    arts: { bytes: number; count: number };
    audios: { bytes: number; count: number };
    documents: { bytes: number; count: number };
    others: { bytes: number; count: number };
    trash: { bytes: number; count: number };
  };
  counts: {
    totalFiles: number;
    totalFolders: number;
    totalEvents: number;
    totalUsers: number;
    totalShares: number;
  };
  recentActivities: Activity[];
}

export interface SystemSettings {
  churchName: string;
  churchSubtitle: string;
  storageEngine: string;
  totalQuotaBytes: number;
  updatedAt: string;
  projectId?: string;
  storageBucket?: string;
  firestoreDatabaseId?: string;
  authDomain?: string;
  gcsBucket?: string;
  gcsProjectId?: string;
  settings?: any;
  gcsInstructions?: any;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'waiting' | 'uploading' | 'processing' | 'completed' | 'error';
  speed?: string;
  error?: string;
  folderId?: string | null;
  eventId?: string | null;
  tags?: string[];
  uploadTask?: any;
}

export type ViewTab =
  | 'dashboard'
  | 'files'
  | 'schedule'
  | 'photos'
  | 'videos'
  | 'arts'
  | 'audios'
  | 'documents'
  | 'events'
  | 'recents'
  | 'favorites'
  | 'shares'
  | 'trash'
  | 'users'
  | 'church'
  | 'admin'
  | 'history'
  | 'settings';

export interface ChurchLeadershipMember {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
}

export interface ChurchServiceSchedule {
  id: string;
  day: string;
  time: string;
  title: string;
  description?: string;
}

export interface ChurchProfile {
  id: string;
  name: string;
  slogan: string;
  highlightVerse: {
    text: string;
    reference: string;
  };
  welcomeMessage: string;
  history: string;
  mission: string;
  vision: string;
  values: string[];
  leadership: ChurchLeadershipMember[];
  serviceTimes: ChurchServiceSchedule[];
  heroBannerUrl: string;
  logoUrl?: string;
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: string;
    cityState: string;
    mapsEmbedUrl?: string;
    mapsLink?: string;
  };
  social: {
    instagram?: string;
    youtube?: string;
    facebook?: string;
    spotify?: string;
  };
  updatedAt: string;
  updatedBy?: string;
}

export type PublicationStatus = 'draft' | 'published';

export interface ChurchAnnouncement {
  id: string;
  title: string;
  content: string;
  category: string;
  date: string;
  isPinned: boolean;
  status: PublicationStatus;
  scheduledAt?: string | null;
  imageUrl?: string | null;
  authorName: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchPublicEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  category: string;
  bannerUrl?: string | null;
  status: PublicationStatus;
  authorName: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  coverImageUrl?: string | null;
  status: PublicationStatus;
  publishedAt: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchAlbumPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface ChurchAlbumVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
}

export interface ChurchAlbum {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  coverUrl: string;
  photos: ChurchAlbumPhoto[];
  videos: ChurchAlbumVideo[];
  status: PublicationStatus;
  authorName: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChurchDownload {
  id: string;
  title: string;
  description: string;
  category: 'boletim' | 'estudo' | 'partitura' | 'leitura' | 'outro';
  fileUrl: string;
  fileSize: number;
  format: string;
  downloadCount: number;
  status: PublicationStatus;
  authorName: string;
  authorUid: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// CENTRAL DE AGENDA, ESCALAS & ANOTAÇÕES DA EQUIPE
// ==========================================
export type TeamTaskCategory =
  | 'transmissao'
  | 'som'
  | 'projecao'
  | 'fotografia'
  | 'video'
  | 'design_redes'
  | 'iluminacao'
  | 'outro';

export type TeamTaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type TeamTaskStatus = 'pendente' | 'em_andamento' | 'concluido';

export interface TeamTaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface TeamTask {
  id: string;
  title: string;
  description?: string;
  category: TeamTaskCategory;
  eventId?: string | null;
  eventName?: string | null;
  assignedToUid: string;
  assignedToName: string;
  assignedToEmail?: string;
  assignedToAvatar?: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  priority: TeamTaskPriority;
  status: TeamTaskStatus;
  createdByUid: string;
  createdByName: string;
  completedAt?: string | null;
  checklist?: TeamTaskChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamNote {
  id: string;
  title: string;
  content: string;
  category?: string;
  color?: 'amber' | 'emerald' | 'sky' | 'rose' | 'purple' | 'stone';
  isPinned: boolean;
  authorUid: string;
  authorName: string;
  relatedEventId?: string | null;
  relatedEventName?: string | null;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}
