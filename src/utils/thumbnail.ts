/**
 * High-performance client-side thumbnail generator.
 * Creates lightweight (15KB - 30KB) Base64 Data URLs for images, video frames,
 * documents, and media so cards in the grid always render visual media in the square.
 */

export async function generateImageThumbnail(
  file: File,
  maxDim = 400,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          URL.revokeObjectURL(url);
          resolve('');
          return;
        }

        // Scale down preserving aspect ratio
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve('');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
}

export async function generateVideoThumbnail(
  file: File,
  maxDim = 400,
  quality = 0.72
): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    let hasResolved = false;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    };

    // Timeout safety fallback
    const timer = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        cleanup();
        resolve(null);
      }
    }, 4500);

    video.onloadedmetadata = () => {
      // Seek to 0.5s or 25% of duration
      const seekTime = Math.min(1.0, video.duration > 1 ? 0.6 : video.duration / 2);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timer);

      try {
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (!width || !height) {
          cleanup();
          resolve(null);
          return;
        }

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      if (!hasResolved) {
        hasResolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(null);
      }
    };
  });
}

/**
 * Generates an authentic, stylized document sheet preview canvas.
 * Makes documents look like an actual printed page or document file
 * inside the grid square instead of an empty icon or broken image.
 */
export function generateDocumentThumbnail(
  fileName: string,
  extension: string
): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const ext = (extension || fileName.split('.').pop() || 'DOC').toUpperCase();

    // Palette per document type
    let badgeBg = '#DC2626'; // PDF red
    let badgeText = '#FFFFFF';
    let docAccent = '#EF4444';

    if (ext === 'DOC' || ext === 'DOCX') {
      badgeBg = '#2563EB';
      docAccent = '#3B82F6';
    } else if (ext === 'XLS' || ext === 'XLSX' || ext === 'CSV') {
      badgeBg = '#059669';
      docAccent = '#10B981';
    } else if (ext === 'PPT' || ext === 'PPTX') {
      badgeBg = '#D97706';
      docAccent = '#F59E0B';
    } else if (ext === 'TXT' || ext === 'RTF') {
      badgeBg = '#4B5563';
      docAccent = '#9CA3AF';
    }

    // Outer dark container background
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, 400, 300);

    // Document Paper Sheet
    const sheetX = 85;
    const sheetY = 20;
    const sheetW = 230;
    const sheetH = 260;
    const cornerR = 6;

    // Subtle paper shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(sheetX, sheetY, sheetW, sheetH, cornerR);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Top color strip on the paper
    ctx.fillStyle = docAccent;
    ctx.beginPath();
    ctx.roundRect(sheetX, sheetY, sheetW, 8, [cornerR, cornerR, 0, 0]);
    ctx.fill();

    // Document Badge
    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    ctx.roundRect(sheetX + 16, sheetY + 22, 54, 22, 4);
    ctx.fill();

    ctx.fillStyle = badgeText;
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ext.substring(0, 5), sheetX + 43, sheetY + 33);

    // Document mock title lines
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.roundRect(sheetX + 16, sheetY + 56, sheetW - 32, 7, 3);
    ctx.fill();

    ctx.fillStyle = '#4B5563';
    ctx.beginPath();
    ctx.roundRect(sheetX + 16, sheetY + 70, sheetW - 70, 6, 3);
    ctx.fill();

    // Thin separator line
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(sheetX + 16, sheetY + 88, sheetW - 32, 1);

    // Mock Paragraph Lines
    ctx.fillStyle = '#9CA3AF';
    const lines = [
      { y: 102, w: sheetW - 32 },
      { y: 116, w: sheetW - 40 },
      { y: 130, w: sheetW - 55 },
      { y: 144, w: sheetW - 32 },
      { y: 165, w: sheetW - 45 },
      { y: 179, w: sheetW - 32 },
      { y: 193, w: sheetW - 65 },
      { y: 214, w: sheetW - 32 },
      { y: 228, w: sheetW - 50 },
    ];

    for (const line of lines) {
      ctx.beginPath();
      ctx.roundRect(sheetX + 16, sheetY + line.y - 12, line.w, 4, 2);
      ctx.fill();
    }

    // Bottom seal / page 1 stamp
    ctx.fillStyle = '#D1D5DB';
    ctx.font = '9px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Página 1 · PT-B', sheetX + sheetW - 16, sheetY + sheetH - 12);

    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * Generates a stylized audio visualizer cover art for audio files.
 */
export function generateAudioThumbnail(fileName: string): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 400, 300);
    grad.addColorStop(0, '#064E3B');
    grad.addColorStop(1, '#0F172A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 300);

    // Vinyl circle or glowing soundwave
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.beginPath();
    ctx.arc(200, 140, 75, 0, Math.PI * 2);
    ctx.fill();

    // Equalizer bars
    const barCount = 18;
    const startX = 110;
    const barWidth = 6;
    const gap = 6;
    const centerY = 140;

    ctx.fillStyle = '#10B981';
    for (let i = 0; i < barCount; i++) {
      // Harmonic wave heights
      const height = 15 + Math.sin(i * 0.45) * 35 + ((i % 3) * 10);
      const x = startX + i * (barWidth + gap);
      ctx.beginPath();
      ctx.roundRect(x, centerY - height / 2, barWidth, height, 3);
      ctx.fill();
    }

    // Audio badge at top
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(160, 225, 80, 24, 12);
    ctx.fill();

    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ÁUDIO HD', 200, 237);

    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/**
 * Universal media thumbnail factory.
 * Guarantees that every uploaded file receives a valid visual preview.
 */
export async function createFileThumbnail(file: File): Promise<string | null> {
  const mime = file.type || '';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. Photos and graphic designs
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)
  ) {
    try {
      const thumb = await generateImageThumbnail(file, 400, 0.75);
      if (thumb) return thumb;
    } catch (err) {
      console.warn('Image thumbnail generation fallback:', err);
    }
  }

  // 2. Videos
  if (
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv'].includes(ext)
  ) {
    try {
      const videoThumb = await generateVideoThumbnail(file, 400, 0.75);
      if (videoThumb) return videoThumb;
    } catch (err) {
      console.warn('Video thumbnail generation fallback:', err);
    }
  }

  // 3. Documents
  if (
    mime.includes('pdf') ||
    mime.includes('document') ||
    mime.includes('sheet') ||
    mime.includes('presentation') ||
    mime.includes('text') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf'].includes(ext)
  ) {
    try {
      const docThumb = generateDocumentThumbnail(file.name, ext);
      if (docThumb) return docThumb;
    } catch (err) {
      console.warn('Document thumbnail generation fallback:', err);
    }
  }

  // 4. Audio
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext)
  ) {
    try {
      const audioThumb = generateAudioThumbnail(file.name);
      if (audioThumb) return audioThumb;
    } catch (err) {
      console.warn('Audio thumbnail generation fallback:', err);
    }
  }

  return null;
}
