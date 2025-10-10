# Therapy Matching App

This is a separate deployment configuration for the therapy matching functionality (V17).

## Deployment

This app is deployed to `matching.risetwice.com` via Vercel.

### Vercel Configuration

**Root Directory:** `apps/matching`

**Build Command:**
```bash
cd ../.. && npm install && cd apps/matching && npx next build
```

**Output Directory:** `.next` (default)

### Environment Variables

To hide the bottom navigation footer (AI Companion + Therapy Match tabs), add this environment variable in Vercel:

```
NEXT_PUBLIC_FOOTER_TYPE=none
```

#### Footer Options

- **No variable set** or `NEXT_PUBLIC_FOOTER_TYPE=default`: Shows standard footer with both AI Companion and Therapy Match links
- `NEXT_PUBLIC_FOOTER_TYPE=none`: Hides footer completely
- **Future**: Can add `NEXT_PUBLIC_FOOTER_TYPE=matching` for a custom matching-only footer

### How It Works

1. This deployment uses the same codebase as the main app (`/src`)
2. The `next.config.js` rewrites the homepage (`/`) to `/chatbotV17`
3. All APIs, components, and functionality remain the same
4. Only the entry point and footer visibility differ from the main deployment

### Local Testing

**Note:** Local testing from `apps/matching` directory is not supported. The configuration is designed specifically for Vercel deployment, which handles parent directory access differently.

To test changes before deploying:
1. Test from the root directory: `npm run dev` (runs main app)
2. Set `NEXT_PUBLIC_FOOTER_TYPE=none` in root `.env.local` to preview footer-hidden mode
3. Visit `localhost:3000/chatbotV17`

Or deploy to Vercel preview environment for full testing.

### Notes

- Same database, auth, and APIs as main app
- Same dependencies (uses root `package.json`)
- Only one new file needed: `next.config.js`
- Footer configuration can be changed in Vercel without code changes
