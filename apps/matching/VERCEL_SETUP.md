# Vercel Setup Guide for Therapy Matching App

## Quick Setup Checklist

### 1. Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your repository: `risetwice_opensource`
4. **Important:** Same repo as your main app

### 2. Configure Root Directory

In project settings:
- **Root Directory:** `apps/matching`
- **Framework Preset:** Next.js (auto-detected)

### 3. Configure Build Settings

**Build Command:**
```bash
cd ../.. && npm install && cd apps/matching && npx next build
```

**Output Directory:**
```
.next
```
(default, leave as-is)

**Install Command:**
```bash
npm install
```
(runs in root directory due to build command)

### 4. Add Environment Variables

Copy ALL environment variables from your main app, then add:

```
NEXT_PUBLIC_FOOTER_TYPE=none
```

**Required variables to copy from main app:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `ELEVENLABS_API_KEY`
- All other env vars from your main deployment

### 5. Deploy

Click "Deploy" and wait for build to complete.

### 6. Configure Custom Domain

1. Go to Project Settings → Domains
2. Add domain: `matching.risetwice.com`
3. Follow Vercel's DNS configuration instructions

---

## Expected Behavior

**Homepage (`matching.risetwice.com/`):**
- Automatically redirects to therapy matching interface (V17)
- Footer is hidden (no AI Companion / Therapy Match tabs)

**All other routes work normally:**
- `matching.risetwice.com/api/*` - All APIs accessible
- `matching.risetwice.com/chatbotV16` - Still accessible if needed
- Same database, auth, and functionality as main app

---

## Troubleshooting

### Build Fails with "Can't find pages or app directory"

**Solution:** Make sure Root Directory is set to `apps/matching` (not root `/`)

### Build Fails with Module Resolution Errors

**Solution:** Verify build command includes `cd ../.. && npm install` to install from root

### Environment Variables Not Working

**Solution:**
1. Check all env vars are copied from main app
2. Redeploy after adding variables (they only apply to new builds)

### Footer Still Showing

**Solution:**
1. Verify `NEXT_PUBLIC_FOOTER_TYPE=none` is set in Vercel env vars
2. Check it's set for all environments (Production, Preview, Development)
3. Redeploy

---

## Files in This Directory

```
apps/matching/
├── next.config.js    - Rewrites / to /chatbotV17, enables parent dir access
├── README.md         - Documentation
├── VERCEL_SETUP.md   - This file
└── .next/            - Build output (gitignored)
```

That's it! Only one config file needed.

---

## Updating the App

Since both deployments share the same codebase:

1. Make changes in `/src` (shared source)
2. Push to GitHub
3. Both main app and matching app will rebuild automatically
4. To change footer behavior, just update env vars in Vercel (no code changes needed)

---

## Testing Before Production Deploy

**Option 1: Deploy to Vercel Preview**
- Push to a branch
- Vercel creates preview deployment automatically
- Test at preview URL

**Option 2: Test in Main App**
- Add `NEXT_PUBLIC_FOOTER_TYPE=none` to root `.env.local`
- Run `npm run dev` from root
- Visit `localhost:3000/chatbotV17`
- Should match what matching app will look like

---

## Support

If deployment fails or something doesn't work as expected, check:
1. Vercel build logs for specific errors
2. Ensure all env vars are present
3. Verify root directory is set correctly
4. Compare with main app's Vercel configuration
