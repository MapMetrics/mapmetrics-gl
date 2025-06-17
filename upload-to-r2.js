import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BUCKET_NAME = 'mapmetrics-cdn';
const DIST_DIR = './dist';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function uploadFile(filePath, key) {
    const fileContent = readFileSync(filePath);
    
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: getContentType(filePath),
        CacheControl: 'public, max-age=31536000, immutable',
    });

    try {
        await s3Client.send(command);
        console.log(`Uploaded ${key}`);
    } catch (err) {
        console.error(`Error uploading ${key}:`, err);
    }
}

function getContentType(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    const contentTypes = {
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'svg': 'image/svg+xml',
    };
    return contentTypes[ext] || 'application/octet-stream';
}

async function uploadDirectory(dir, prefix = '') {
    const files = readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
        const filePath = join(dir, file.name);
        const key = prefix ? `${prefix}/${file.name}` : file.name;
        
        if (file.isDirectory()) {
            await uploadDirectory(filePath, key);
        } else {
            await uploadFile(filePath, key);
        }
    }
}

// Upload the dist directory
uploadDirectory(DIST_DIR, 'dist')
    .then(() => console.log('Upload complete'))
    .catch(console.error);
