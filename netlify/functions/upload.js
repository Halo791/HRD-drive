const { Readable } = require('stream');
const fs = require('fs');
const formidable = require('formidable');
const {
  createMinioClient,
  ensureBucket,
  isAuthorized,
  makeObjectName,
  unauthorized
} = require('./_lib');

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: true,
      maxFileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES || 50 * 1024 * 1024)
    });

    const body = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'utf8');
    const stream = Readable.from(body);
    stream.headers = {
      'content-type': event.headers['content-type'] || event.headers['Content-Type'] || ''
    };
    stream.method = 'POST';
    stream.url = '/';

    form.parse(stream, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      resolve({ fields, files });
    });
  });
}

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return unauthorized();
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { client, bucket } = createMinioClient();
    await ensureBucket(client, bucket);

    const { files } = await parseMultipart(event);
    const inputFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : [];

    if (inputFiles.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No files uploaded' })
      };
    }

    for (const file of inputFiles) {
      const objectName = makeObjectName(file.originalFilename || file.originalname || 'file');
      await client.putObject(
        bucket,
        objectName,
        fs.createReadStream(file.filepath),
        file.size,
        {
          'Content-Type': file.mimetype || 'application/octet-stream',
          'X-Amz-Meta-Original-Name': file.originalFilename || file.originalname || 'file'
        }
      );
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `${inputFiles.length} file berhasil diupload.` })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Upload failed' })
    };
  }
};
