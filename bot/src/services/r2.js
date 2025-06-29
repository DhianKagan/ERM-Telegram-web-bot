// Загрузка файлов в облачное хранилище R2. Модули: aws-sdk, config
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const { r2 } = require('../config')
const client = new S3Client({
  region: 'auto',
  endpoint: r2.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey
  }
})

async function uploadFile(buffer, key) {
  const cmd = new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: buffer })
  await client.send(cmd)
}

module.exports = { uploadFile, client }
