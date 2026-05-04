const path = require('path');
const { URL } = require('url');
const fs = require('fs');
const fsp = require('fs/promises');
const express = require('express');
const multer = require('multer');
const Minio = require('minio');
require('dotenv').config();

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const storageDriver = String(process.env.STORAGE_DRIVER || 'minio').toLowerCase();
const localStorageDir = path.join(__dirname, process.env.LOCAL_STORAGE_DIR || 'local-storage');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024)
  }
});

function getMinioConfig() {
  if (process.env.MINIO_ENDPOINT_URL) {
    const parsed = new URL(process.env.MINIO_ENDPOINT_URL);
    return {
      endPoint: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
      useSSL: parsed.protocol === 'https:'
    };
  }

  return {
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: Number(process.env.MINIO_PORT || 9000),
    useSSL: String(process.env.MINIO_USE_SSL || 'false').toLowerCase() === 'true'
  };
}

function createMinioClient() {
  const { endPoint, port, useSSL } = getMinioConfig();

  return new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
  });
}

const minioClient = createMinioClient();
const bucketName = process.env.MINIO_BUCKET || 'storage';
const appName = process.env.APP_NAME || 'MinIO Storage';

function sanitizeFileName(fileName) {
  const base = path.basename(fileName || 'file');
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '') || 'file';
}

function makeObjectName(originalName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${stamp}__${sanitizeFileName(originalName)}`;
}

async function ensureBucket() {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, process.env.MINIO_REGION || undefined);
  }
}

async function ensureLocalStorageDir() {
  await fsp.mkdir(localStorageDir, { recursive: true });
}

async function listLocalObjects() {
  await ensureLocalStorageDir();
  const files = await fsp.readdir(localStorageDir, { withFileTypes: true });
  const objects = [];

  for (const entry of files) {
    if (!entry.isFile()) {
      continue;
    }

    const fullPath = path.join(localStorageDir, entry.name);
    const stat = await fsp.stat(fullPath);
    const parts = entry.name.split('__');
    const displayName = parts.length > 1 ? parts.slice(1).join('__') : entry.name;

    objects.push({
      name: entry.name,
      displayName,
      size: stat.size,
      lastModified: stat.mtime
    });
  }

  objects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  return objects;
}

async function listObjects() {
  if (storageDriver === 'local') {
    return await listLocalObjects();
  }

  return await new Promise((resolve, reject) => {
    const objects = [];
    const stream = minioClient.listObjectsV2(bucketName, '', true);

    stream.on('data', (obj) => {
      const parts = obj.name.split('__');
      const displayName = parts.length > 1 ? parts.slice(1).join('__') : obj.name;

      objects.push({
        name: obj.name,
        displayName,
        size: obj.size,
        lastModified: obj.lastModified
      });
    });

    stream.on('end', () => {
      objects.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
      resolve(objects);
    });

    stream.on('error', reject);
  });
}

function getDownloadName(objectName, metaData = {}) {
  const originalName = metaData['x-amz-meta-original-name'];
  if (originalName) {
    return sanitizeFileName(originalName);
  }

  const parts = objectName.split('__');
  return parts.length > 1 ? parts.slice(1).join('__') : objectName;
}

function authMiddleware(req, res, next) {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;

  if (!username) {
    return next();
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme !== 'Basic' || !encoded) {
    res.setHeader('WWW-Authenticate', 'Basic realm="MinIO Storage"');
    return res.status(401).send('Authentication required');
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  const user = separatorIndex >= 0 ? decoded.slice(0, separatorIndex) : '';
  const pass = separatorIndex >= 0 ? decoded.slice(separatorIndex + 1) : '';

  if (user === username && pass === password) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="MinIO Storage"');
  return res.status(401).send('Authentication required');
}

app.use(authMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

function flashFromQuery(query) {
  return {
    message: query.message || '',
    error: query.error || ''
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', async (req, res) => {
  try {
    const objects = await listObjects();

    res.render('index', {
      appName,
      bucketName,
      bucketReady: true,
      objects,
      ...flashFromQuery(req.query),
      uploadLimitMb: Math.round(Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024) / 1024 / 1024)
    });
  } catch (error) {
    res.status(500).render('index', {
      appName,
      bucketName,
      bucketReady: false,
      objects: [],
      message: '',
      error: error.message || 'Gagal memuat data',
      uploadLimitMb: Math.round(Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024) / 1024 / 1024)
    });
  }
});

app.post('/upload', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.redirect('/?error=' + encodeURIComponent('Pilih minimal satu file untuk diupload.'));
    }

    for (const file of files) {
      const objectName = makeObjectName(file.originalname);
      if (storageDriver === 'local') {
        await ensureLocalStorageDir();
        await fsp.writeFile(path.join(localStorageDir, objectName), file.buffer);
      } else {
        await minioClient.putObject(bucketName, objectName, file.buffer, file.size, {
          'Content-Type': file.mimetype,
          'X-Amz-Meta-Original-Name': file.originalname
        });
      }
    }

    return res.redirect('/?message=' + encodeURIComponent(`${files.length} file berhasil diupload ke MinIO.`));
  } catch (error) {
    return res.redirect('/?error=' + encodeURIComponent(error.message || 'Upload gagal.'));
  }
});

app.get('/files/:name', async (req, res) => {
  try {
    const objectName = req.params.name;
    let stat;
    let stream;
    let downloadName;
    let contentType = 'application/octet-stream';

    if (storageDriver === 'local') {
      const fullPath = path.join(localStorageDir, objectName);
      stat = await fsp.stat(fullPath);
      stream = fs.createReadStream(fullPath);
      downloadName = getDownloadName(objectName);
    } else {
      stat = await minioClient.statObject(bucketName, objectName);
      stream = await minioClient.getObject(bucketName, objectName);
      downloadName = getDownloadName(objectName, stat.metaData || {});
      contentType = (stat.metaData && stat.metaData['content-type']) || 'application/octet-stream';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(500).send(error.message || 'Gagal mengunduh file');
      } else {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  } catch (error) {
    res.status(404).send(error.message || 'File tidak ditemukan');
  }
});

app.post('/delete/:name', async (req, res) => {
  try {
    if (storageDriver === 'local') {
      await fsp.unlink(path.join(localStorageDir, req.params.name));
    } else {
      await minioClient.removeObject(bucketName, req.params.name);
    }
    return res.redirect('/?message=' + encodeURIComponent('File berhasil dihapus.'));
  } catch (error) {
    return res.redirect('/?error=' + encodeURIComponent(error.message || 'Gagal menghapus file.'));
  }
});

app.use((error, _req, res, _next) => {
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.redirect('/?error=' + encodeURIComponent('Ukuran file melebihi batas upload.'));
  }

  console.error(error);
  return res.redirect('/?error=' + encodeURIComponent(error.message || 'Terjadi kesalahan.'));
});

async function start() {
  if (storageDriver === 'local') {
    await ensureLocalStorageDir();
  } else {
    const retries = Number(process.env.MINIO_STARTUP_RETRIES || 10);
    const delayMs = Number(process.env.MINIO_STARTUP_DELAY_MS || 2000);

    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        await ensureBucket();
        break;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        console.log(`Waiting for MinIO (${attempt}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`${appName} running on port ${port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
