export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return `${val} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function getMediaCategoryLabel(type: string): string {
  switch (type) {
    case 'photo':
      return 'Foto';
    case 'video':
      return 'Vídeo';
    case 'art':
      return 'Arte Gráfica';
    case 'audio':
      return 'Áudio';
    case 'document':
      return 'Documento';
    case 'archive':
      return 'Arquivo Compactado';
    default:
      return 'Outro';
  }
}

export function getRoleBadgeStyle(role: string): { label: string; textClass: string; borderClass: string } {
  switch (role) {
    case 'super_admin':
      return {
        label: 'Super Administrador',
        textClass: 'text-amber-500 dark:text-amber-400',
        borderClass: 'border-amber-500/30',
      };
    case 'media_admin':
      return {
        label: 'Administrador de Mídia',
        textClass: 'text-blue-500 dark:text-blue-400',
        borderClass: 'border-blue-500/30',
      };
    case 'media_member':
    default:
      return {
        label: 'Membro da Mídia',
        textClass: 'text-emerald-500 dark:text-emerald-400',
        borderClass: 'border-emerald-500/30',
      };
  }
}
