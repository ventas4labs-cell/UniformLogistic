# Deployment Guide for Uniform Logistic

This application is built with **React (+Vite)** and uses **Supabase** for the backend. It is designed to be deployed as a static site (SPA).

## 1. Prerequisites

Before you begin, ensure you have:
1.  Access to the source code (this folder).
2.  An account on [Netlify](https://www.netlify.com) or [Vercel](https://vercel.com) (both have free tiers).
3.  Your **Supabase Project URL** and **Anon Key**.

## 2. Deploy to Netlify (Recommended)

We have included a `netlify.toml` file to make this process seamless.

### Option A: Drag & Drop (Easiest)
1.  Run `npm run build` in your local terminal.
2.  This creates a `dist` folder.
3.  Log in to Netlify and go to "Sites".
4.  Drag and drop the `dist` folder into the "Drop folder here" area.
5.  **Important**: After upload, go to **Site Settings > Environment Variables** and add:
    -   `VITE_SUPABASE_URL`: Your Supabase URL (e.g., `https://xyz.supabase.co`)
    -   `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key
6.  The site might not work fully until these variables are added.

### Option B: Git Integration (Professional)
1.  Push this code to a GitHub/GitLab repository.
2.  Log in to Netlify and click "Add new site" -> "Import from Git".
3.  Connect to your repository.
4.  Netlify will auto-detect the settings:
    -   **Build command**: `npm run build`
    -   **Publish directory**: `dist`
5.  Click **"Show advanced"** (or go to settings later) and add your environment variables:
    -   `VITE_SUPABASE_URL`
    -   `VITE_SUPABASE_ANON_KEY`
6.  Click **Deploy**.

## 3. Deploy to Vercel

1.  Push your code to GitHub/GitLab.
2.  Log in to Vercel and "Add New..." -> "Project".
3.  Import your repository.
4.  Vercel will auto-detect Vite.
5.  Expand the **"Environment Variables"** section and add:
    -   `VITE_SUPABASE_URL`
    -   `VITE_SUPABASE_ANON_KEY`
6.  Click **Deploy**.

## 4. Verification

After deployment:
1.  Open your new public URL.
2.  **Test Login/Signup**: Ensure you can create accounts or log in.
3.  **Test Checkout**: Place a test order to ensure it saves to Supabase.
4.  **Admin Access**: Log in with `ulogisticcr@gmail.com` to verify Admin Dashboard access.

## Troubleshooting

-   **White Screen on Refresh**: Ensure the SPA redirect rules are active.
    -   *Netlify*: The included `netlify.toml` handles this.
    -   *Vercel*: Handles this automatically for Vite apps.
-   **Supabase Connection Error**: Double-check your Environment Variables in the host dashboard. They must match exactly (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
