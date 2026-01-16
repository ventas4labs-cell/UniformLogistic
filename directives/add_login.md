# Add Login with Supabase

## Goal
Implement a secure and aesthetic login screen for the Uniform Logistic Ordering app using Supabase Authentication. The login should be the first screen the user sees.

## Requirements
1.  **Dependencies**: Install `@supabase/supabase-js`.
2.  **Configuration**: Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`.
3.  **Components**: Create a premium `Login.tsx` component matching the app's orange/black theme.
4.  **Logic**:
    *   Initialize Supabase client in `services/supabase.ts`.
    *   Modify `App.tsx` to handle authentication state.
    *   If no session exists, show `AppView.LOGIN`.
    *   Upon successful login, transition to `AppView.LANDING`.
    *   Add a logout function.

## Detailed Steps
1.  Reference Supabase project: `tojsbuucbcuakxxhsqjv`.
2.  Update `types.ts` to add `LOGIN` to `AppView`.
3.  Create `services/supabase.ts` to export the initialized client.
4.  Create `components/Login.tsx` with email/password login (or magic link if preferred, but email/password is standard for "apps"). *Actually, for simplicity and UX, let's use Email/Password or potentially just "Sign in with Google" if configured, but we'll stick to Email/Password + Sign Up toggle for now.*
5.  Refactor `App.tsx`:
    *   Add `useEffect` to check `supabase.auth.getSession`.
    *   Listen to `supabase.auth.onAuthStateChange`.
    *   Conditionally render Login view.
