import fs from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const rootDir = process.cwd();
const shardDir = path.resolve(
  rootDir,
  process.env.SHARD_DIR || 'server/value-history-archive/player-value-history-shards'
);
const bucket = process.env.VALUE_HISTORY_SHARDS_BUCKET || process.env.AWS_S3_BUCKET;
const prefix = String(process.env.VALUE_HISTORY_SHARDS_PREFIX || 'value-history/player-value-history-shards')
  .replace(/^\/+|\/+$/g, '');
const endpoint = process.env.VALUE_HISTORY_SHARDS_ENDPOINT || process.env.AWS_ENDPOINT_URL_S3 || process.env.AWS_ENDPOINT_URL;
const region = process.env.AWS_REGION || process.env.VALUE_HISTORY_SHARDS_REGION || 'auto';
const dryRun = process.env.DRY_RUN !== '0';

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${bytes} B`;
}

function contentTypeFor(fileName) {
  if (fileName.endsWith('.json')) return 'application/json; charset=utf-8';
  if (fileName.endsWith('.json.gz')) return 'application/json';
  return 'application/octet-stream';
}

function cacheControlFor(fileName) {
  if (fileName === 'manifest.json') return 'public, max-age=300, stale-while-revalidate=86400';
  return 'public, max-age=31536000, immutable';
}

function listFiles(dir) {
  return fs.readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.json') || fileName.endsWith('.json.gz'))
    .sort()
    .map((fileName) => {
      const filePath = path.join(dir, fileName);
      return {
        fileName,
        filePath,
        key: `${prefix}/${fileName}`,
        bytes: fs.statSync(filePath).size,
      };
    });
}

if (!fs.existsSync(shardDir)) {
  console.error(`Shard directory not found: ${path.relative(rootDir, shardDir)}`);
  process.exit(1);
}

const files = listFiles(shardDir);
const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);

if (!bucket) {
  console.error('Missing VALUE_HISTORY_SHARDS_BUCKET or AWS_S3_BUCKET.');
  console.error('Run with DRY_RUN=1 to inspect files, or set bucket credentials and DRY_RUN=0 to upload.');
  process.exit(1);
}

console.log(JSON.stringify({
  dryRun,
  shardDir: path.relative(rootDir, shardDir),
  bucket,
  prefix,
  endpoint: endpoint || null,
  region,
  fileCount: files.length,
  totalBytes,
  totalSize: formatBytes(totalBytes),
}, null, 2));

if (dryRun) {
  console.log('Dry run only. Set DRY_RUN=0 to upload.');
  process.exit(0);
}

const client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle: process.env.VALUE_HISTORY_SHARDS_FORCE_PATH_STYLE === '1' ? true : undefined,
});

let uploadedBytes = 0;
for (const file of files) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: file.key,
    Body: fs.createReadStream(file.filePath),
    ContentType: contentTypeFor(file.fileName),
    CacheControl: cacheControlFor(file.fileName),
  }));
  uploadedBytes += file.bytes;
  console.log(`uploaded ${file.key} (${formatBytes(file.bytes)})`);
}

console.log(`Uploaded ${files.length} files (${formatBytes(uploadedBytes)}) to s3://${bucket}/${prefix}`);
