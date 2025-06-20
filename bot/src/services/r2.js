// Загрузка файлов в облачное хранилище R2
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

async function uploadFile(buffer, key) {
  const cmd = new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: buffer })
  await client.send(cmd)
}

module.exports = { uploadFile, client }
