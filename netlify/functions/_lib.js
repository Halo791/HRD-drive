const path = require('path');
const Minio = require('minio');

function getMinioConfig() {
  const endpointUrl = process.env.MINIO_ENDPOINT_URL || 'http://127.0.0.1:9000';
  const parsed = new URL(endpointUrl);

  return {
    endPoint: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80,
    useSSL: parsed.protocol === 'https:',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'storage'
  };
}

function createMinioClient() {
  const config = getMinioConfig();

  return {
    client: new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    }),
    bucket: config.bucket
  };
}

function sanitizeFileName(fileName) {
  const base = path.basename(fileName || 'file');
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+/, '') || 'file';
}

function makeObjectName(originalName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${stamp}__${sanitizeFileName(originalName)}`;
}

function getBasicAuthHeader() {
  const user = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;

  if (!user) {
    return null;
  }

  return `Basic ${Buffer.from(`${user}:${password || ''}`).toString('base64')}`;
}

function isAuthorized(event) {
  if (!process.env.APP_USERNAME) {
    return true;
  }

  const expected = getBasicAuthHeader();
  return String(event.headers.authorization || '') === expected;
}

function unauthorized() {
  return {
    statusCode: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="MinIO Storage"',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ error: 'Authentication required' })
  };
}

async function ensureBucket(client, bucket) {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket, process.env.MINIO_REGION || undefined);
  }
}

module.exports = {
  createMinioClient,
  ensureBucket,
  getBasicAuthHeader,
  isAuthorized,
  makeObjectName,
  sanitizeFileName,
  unauthorized
};

