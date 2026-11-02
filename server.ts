import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded media files directly
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(express.json({ limit: '50mb' }));

// Dedicated binary upload endpoint for files when Firebase Cloud Storage bucket is not yet active
app.post('/api/upload', express.raw({ type: '*/*', limit: '250mb' }), (req, res) => {
  const rawFileName = req.headers['x-filename'] as string || `file_${Date.now()}`;
  const decodedFileName = decodeURIComponent(rawFileName);
  const cleanName = decodedFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueName = `${Date.now()}_${cleanName}`;
  const filePath = path.join(UPLOADS_DIR, uniqueName);

  const buffer = req.body as Buffer;
  if (!buffer || buffer.length === 0) {
    return res.status(400).json({ error: 'Nenhum dado recebido para upload.' });
  }

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error('[Upload API] Error writing file to disk:', err);
      return res.status(500).json({ error: 'Falha ao salvar arquivo no armazenamento local.' });
    }

    const downloadUrl = `/uploads/${uniqueName}`;
    res.json({
      success: true,
      filename: uniqueName,
      originalName: decodedFileName,
      downloadUrl,
      size: buffer.length,
    });
  });
});

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    platform: 'PT-B Mídia',
    infrastructure: 'Firebase + Dedicated Storage',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PT-B Mídia Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
