import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const sourceDir = '/Users/jimvanderheiden/devprog2/untitledfolder/basemaps-assets';
const bucket = 'mapmetrics-cdn';

// Files to skip
const SKIP_FILES = ['.DS_Store', 'Thumbs.db'];

function uploadFile(filePath) {
    const relativePath = filePath.replace(sourceDir, '').replace(/^\//, '');
    const targetPath = `mapmetrics-cdn/${relativePath}`;
    
    // Skip system files
    if (SKIP_FILES.includes(relativePath.split('/').pop())) {
        console.log(`⏩ Skipping system file: ${relativePath}`);
        return;
    }
    
    console.log(`Uploading: ${relativePath}`);
    
    try {
        // Add content type based on file extension
        const ext = filePath.split('.').pop().toLowerCase();
        let contentType = '';
        
        switch(ext) {
            case 'pbf':
                contentType = '--content-type=application/x-protobuf';
                break;
            case 'png':
                contentType = '--content-type=image/png';
                break;
            case 'jpg':
            case 'jpeg':
                contentType = '--content-type=image/jpeg';
                break;
            case 'json':
                contentType = '--content-type=application/json';
                break;
            case 'css':
                contentType = '--content-type=text/css';
                break;
            case 'js':
                contentType = '--content-type=application/javascript';
                break;
        }
        
        // Use a simpler command structure with proper quoting
        const command = `wrangler r2 object put '${targetPath}' --file='${filePath}' ${contentType} --remote`;
        console.log(`Executing: ${command}`);
        
        execSync(command, { 
            stdio: 'inherit',
            shell: '/bin/bash'
        });
        console.log(`✅ Uploaded: ${relativePath}`);
    } catch (error) {
        console.error(`❌ Failed to upload ${relativePath}:`, error.message);
        // Continue with next file instead of stopping
    }
}

function processDirectory(dir) {
    const items = readdirSync(dir);
    
    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else {
            uploadFile(fullPath);
        }
    }
}

console.log('Starting upload of basemaps assets...');
processDirectory(sourceDir);
console.log('Upload complete!'); 