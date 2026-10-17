RUFFNECK LEARN — HEADER CSS CLEANUP

WHAT THIS DOES
- Replaces the conflicting header CSS block in src/app/globals.css with one consolidated responsive design.
- Preserves all CSS outside that block, including course pages, student dashboards, practical labs, assessments, and certificates.
- Creates src/app/globals.css.before-header-cleanup.bak before making changes.
- Refuses to edit the stylesheet if the expected markers are missing or the target section does not match the inspected file.

HOW TO RUN (WINDOWS COMMAND PROMPT; NOT POWERSHELL)
1. Download fix_ruffneck_css.py.
2. Copy it to the root of your RuffNeck Learn repository, beside package.json.
3. Open Command Prompt and run:

   cd /d C:\Users\DELL\Documents\GitHub\ruffneck-lms
   python fix_ruffneck_css.py

4. Review the result:

   git diff -- src/app/globals.css

5. Run a production build before deploying:

   npm run build

6. If the build succeeds and the preview looks correct, commit and push the change. Do not commit the .bak backup file.

If the script says a marker was not found, it makes no changes. That means your local stylesheet is different from the currently inspected public main branch; keep the file unchanged and inspect the error before proceeding.

SCOPE
This is the first safe CSS consolidation pass for the header area. It does not automatically delete duplicate styles for every other page, because doing so without inspecting cascade and component dependencies could break existing features.
