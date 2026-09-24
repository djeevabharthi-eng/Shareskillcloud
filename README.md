# ShareSkill Cloud

Login: Supabase Auth (email/password + Google). Data: saved to Supabase table `app_state`.

## Setup
1. Supabase > SQL Editor: run `supabase-setup.sql`.
2. Supabase > Authentication > URL Configuration: set Site URL and add Redirect URL = your site URL.
3. Supabase > Project Settings > API: copy the `service_role` key.
4. Deploy on Render (Web Service from this repo, `render.yaml` included). Add env var `SUPABASE_SERVICE_ROLE_KEY`.

## Local
npm install && npm run dev   (needs .env with SUPABASE_SERVICE_ROLE_KEY)
