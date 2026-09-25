import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export function r2Configured() {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME)
}

let _client: S3Client | null = null
function getClient() {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _client
}

export async function uploadPhoto(key: string, body: Buffer, contentType: string) {
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  return key
}

// 非公開バケット前提。表示のたびに期限付きURLを発行する（DBにはR2のキーだけ保存する）
export async function presignPhotoUrl(key: string, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
  return getSignedUrl(getClient(), command, { expiresIn: expiresInSeconds })
}
