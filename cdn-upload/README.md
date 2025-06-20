# MapMetrics CDN Upload Tools

This directory contains tools for uploading the MapMetrics GL library to Cloudflare R2 CDN.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Cloudflare credentials
```

## Usage

To upload files to the CDN:
```bash
npm run upload
```

## Environment Variables

Required environment variables in `.env`:
- `ACCOUNT_ID`: Your Cloudflare account ID
- `R2_ACCESS_KEY_ID`: R2 API access key
- `R2_SECRET_ACCESS_KEY`: R2 API secret key

## File Structure

The upload script will create the following structure in R2:
```
mapmetrics-cdn/
├── dist/
│   ├── mapmetrics-gl.js
│   ├── mapmetrics-gl.css
│   └── [other dist files]
└── versions/
    ├── 0.4.8/
    │   ├── mapmetrics-gl.js
    │   └── mapmetrics-gl.css
    └── latest/
        ├── mapmetrics-gl.js
        └── mapmetrics-gl.css
```

## CDN URLs

After upload, files will be available at:
```
https://cdn.mapmetrics.org/dist/mapmetrics-gl.js
https://cdn.mapmetrics.org/dist/mapmetrics-gl.css
``` 