import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = 'mapmetrics-cdn';
const DIST_DIR = join(__dirname, '../dist');
const VERSION = process.env.npm_package_version || '0.5.9'; // Get version from package.json or default

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function uploadFile(filePath, key, isLatest = false) {
    const fileContent = readFileSync(filePath);

    // Use short cache for "latest" so updates are seen immediately
    // Use long cache for versioned files (immutable)
    const cacheControl = isLatest
        ? 'public, max-age=60, s-maxage=60, must-revalidate'
        : 'public, max-age=31536000, immutable';

    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: getContentType(filePath),
        CacheControl: cacheControl,
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
            // Upload to dist directory
            await uploadFile(filePath, `dist/${key}`, false);

            // Upload to version-specific directory (immutable cache)
            await uploadFile(filePath, `versions/${VERSION}/${key}`, false);

            // Upload to latest directory (short cache for immediate updates)
            await uploadFile(filePath, `versions/latest/${key}`, true);
        }
    }
}

// Validate environment variables
const requiredEnvVars = ['ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    console.error('Please set them in your .env file');
    process.exit(1);
}

console.log(`Starting upload for version ${VERSION}...`);
uploadDirectory(DIST_DIR)
    .then(() => console.log('Upload complete!'))
    .catch(err => {
        console.error('Upload failed:', err);
        process.exit(1);
    }); 