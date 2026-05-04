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

  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const name = event.queryStringParameters && event.queryStringParameters.name;
    if (!name) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing file name' })
      };
    }

    const { client, bucket } = createMinioClient();
    await ensureBucket(client, bucket);
    await client.removeObject(bucket, name);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'File berhasil dihapus.' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Delete failed' })
    };
  }
};

