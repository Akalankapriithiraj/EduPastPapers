EDUPAST PAPERS - GITHUB + SUPABASE VERSION

FILES
- index.html
- style.css
- script.js
- config.js
- supabase-setup.sql
- README.txt

WHAT CHANGED
- Your existing design/content is kept.
- Demo password "admin123" has been removed.
- Admin login now uses Supabase Authentication.
- Papers and subjects are stored in Supabase Database.
- PDF files are stored in the Supabase "past-papers" Storage bucket.
- Public students can read published papers/download PDFs.
- Only users listed in public.admin_users can add/edit/delete papers and subjects.
- RLS policies protect the database and Storage uploads.

SETUP
1. Create a Supabase project.
2. Open SQL Editor and run supabase-setup.sql.
3. In Authentication -> Users, create the admin email/password account.
4. Copy that user's UUID.
5. In SQL Editor run:
   insert into public.admin_users (user_id)
   values ('YOUR-ADMIN-USER-UUID')
   on conflict do nothing;
6. Open Supabase Project Settings -> API.
7. Copy Project URL and the Publishable/anon key into config.js.
8. Do NOT use service_role/secret key in config.js.
9. Upload all files to the ROOT of the GitHub repository.
10. Enable GitHub Pages from Settings -> Pages -> Deploy from a branch -> main -> /(root).

IMPORTANT
- The Supabase bucket name must be exactly "past-papers".
- PDFs must be PDF files and are limited to 20 MB by the site setup.
- The public bucket is intentional: students need to download published PDFs.
- Public users cannot upload, edit, or delete files because Storage RLS only allows admins.
- Never put database passwords, service_role keys, or other secrets in GitHub.
