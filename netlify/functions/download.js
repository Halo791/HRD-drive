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

  if (event.httpMethod !== 'GET') {
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

    const url = await client.presignedGetObject(bucket, name, 60 * 5);

    return {
      statusCode: 302,
      headers: {
        Location: url
      },
      body: ''
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Download failed' })
    };
  }
};

