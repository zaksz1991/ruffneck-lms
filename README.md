# RuffNeck Learn — Certificate Social/Print CSS Repair

## Included
- `src/app/certificate-social-print.css`: page surface, header, certificate preview, and print CSS.
- `tests/certificate-social-print.test.mjs`: static regression checks.

## Integrate
1. Add `src/app/certificate-social-print.css` to the repository at the same path.
2. Open `src/app/layout.tsx`.
3. Add this import immediately after the existing `globals.css` import:

   `import "./certificate-social-print.css";`

4. Leave the certificate page component, logo files, certificate border, watermark, QR code, signatures, seals, and certificate data logic unchanged.

## Intended behaviour
- Application and certificate-page backgrounds use a clean light-grey social-platform-style surface.
- Toolbar/actions use white card styling; RuffNeck navy remains the brand colour and blue is used for interactive accents.
- Certificate preview retains a landscape aspect ratio on screen.
- Print output requests A4 landscape with zero page margins, hides surrounding controls, and fixes the certificate sheet to 297mm × 210mm.

## Verification limitations
This is a CSS integration update, not a production deployment. It has not been tested against a live browser or the deployed Vercel site. Browser print settings can affect background printing; enable “Background graphics” in the print dialog when necessary. Verify that a real certificate with a long name/course title fits one page in the target browser before deployment.

The stylesheet includes selectors for both certificate markup families present in prior project artifacts. Confirm which one is currently active in `main` before deployment.
