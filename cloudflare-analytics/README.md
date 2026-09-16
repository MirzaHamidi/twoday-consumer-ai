# Twoday Studio Analytics Backend - Deployment Guide

## What This Is
A Cloudflare Worker + D1 (SQLite) backend that powers the public Live Stats page on your website.
It tracks **unique visitors** and **unique game plays** with triple-layer deduplication.

## Prerequisites
- A free Cloudflare account (you already have one: contact@twodaystudio.com)
- Node.js 18+ installed on your computer

## Deployment Steps (5 minutes)

### Step 1 - Install Wrangler CLI
```bash
npm install -g wrangler
```

### Step 2 - Login to Cloudflare
```bash
wrangler login
```
This opens your browser. Click "Allow" to authorize.

### Step 3 - Create the D1 Database
```bash
cd cloudflare-analytics
wrangler d1 create tds-analytics-db
```
**Copy the `database_id`** from the output. Open `wrangler.toml` and paste it:
```toml
database_id = "paste-your-id-here"
```

### Step 4 - Create the Tables
```bash
wrangler d1 execute tds-analytics-db --file=schema.sql
```

### Step 5 - Deploy the Worker
```bash
wrangler deploy
```
The output will show your Worker URL, something like:
```
https://tds-analytics.contact-twodaystudio.workers.dev
```

### Step 6 - Connect Your Website
Open these two files and paste the Worker URL:

1. **`tds-analytics.js`** (line 16):
   ```javascript
   var TDS_API = "https://tds-analytics.contact-twodaystudio.workers.dev";
   ```

2. **`analytics.html`** (search for `TDS_API`):
   ```javascript
   var TDS_API = "https://tds-analytics.contact-twodaystudio.workers.dev";
   ```

### Step 7 - Re-upload to Bunny.net
Upload the updated `tds-analytics.js` and `analytics.html` to Bunny.net.

## Done!
Visit `https://twodaystudio.com/analytics.html` to see your live stats.

## Free Tier Limits (more than enough)
| Resource | Free Limit | Your Expected Usage |
|----------|-----------|-------------------|
| Worker requests | 100,000/day | ~1 per new visitor |
| D1 reads | 5,000,000/day | ~1 per analytics page view |
| D1 writes | 100,000/day | ~1 per new unique visitor |
| D1 storage | 5 GB | A few KB (text only) |

Even if your game goes viral with 50,000 new players/day, you'll use less than half the free tier.
