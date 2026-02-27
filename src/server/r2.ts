import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "~/env.js";

/**
 * Cloudflare R2 is S3-compatible. The endpoint follows the pattern:
 * https://<account-id>.r2.cloudflarestorage.com
 */
function createR2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Upload a PDF buffer to R2 and return the public-accessible URL.
 *
 * Key format: invoices/<gmailMessageId>/<filename>
 * This keeps all attachments for an email grouped under a stable prefix.
 */
export async function uploadPdfToR2({
  gmailMessageId,
  filename,
  contentBase64,
}: {
  gmailMessageId: string;
  filename: string;
  contentBase64: string;
}): Promise<string> {
  const client = createR2Client();

  // Sanitise the filename to avoid path traversal / special char issues
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `invoices/${gmailMessageId}/${safeFilename}`;

  const body = Buffer.from(contentBase64, "base64");

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
      // Store the original filename as metadata for later reference
      Metadata: {
        "original-filename": filename,
        "gmail-message-id": gmailMessageId,
      },
    }),
  );

  // R2 endpoint URL for direct access
  const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key}`;

  console.log(`[r2] Uploaded PDF to ${url}`);

  return url;
}
