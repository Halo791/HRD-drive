const {
  createMinioClient,
  ensureBucket,
  isAuthorized,
  unauthorized
} = require('./_lib');

exports.handler = async (event) => {
  if (!isAuthorized(event)) {
    return unauthorized();
  }

  try {
    const { client, bucket } = createMinioClient();
    await ensureBucket(client, bucket);

    const objects = await new Promise((resolve, reject) => {
      const results = [];
      const stream = client.listObjectsV2(bucket, '', true);

      stream.on('data', (obj) => {
        const parts = obj.name.split('__');
        const displayName = parts.length > 1 ? parts.slice(1).join('__') : obj.name;

        results.push({
          name: obj.name,
          displayName,
          size: obj.size,
          lastModified: obj.lastModified
        });
      });

      stream.on('end', () => {
        results.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
        resolve(results);
      });

      stream.on('error', reject);
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objects })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to list files' })
    };
  }
};

