# RuffNeck Learn — Certificate Export Reliability Overlay

This package adds a client-side JPG exporter and a reliable browser-native PDF/print action. It intentionally does not replace certificate lookup, authorization, QR verification, revocation logic, logos, signatures, or seals.

## Important source/dependency note

The supplied source excerpts show the certificate page is a server component and use one of these sheet selectors:
- `.certificate-paper`
- `.mc-paper`
- `.rn-certificate-document`

The latest live repository source and `package.json` could not be fetched in this session, so this is an overlay, not a claim that the current live application has been modified or verified. Do not replace the certificate page with this package.

## Files
- `src/components/CertificateExportActions.tsx` — complete client component.
- `src/components/certificate-export-reliability.css` — print and social-style page background rules.
- `tests/certificate-export-reliability.test.mjs` — source-level regression checks.

## GUI integration
1. In the repository's file browser, add `CertificateExportActions.tsx` under `src/components/`.
2. Add the CSS file in the same folder and import it from the app's global stylesheet entry after the existing global CSS.
3. Ensure `html2canvas` is listed in `package.json` dependencies. If it is not, add it through the repository's package-management UI; do not guess at the current lockfile.
4. In the existing certificate page, import `CertificateExportActions` from `@/components/CertificateExportActions`.
5. Inside the existing certificate toolbar/action group, render:
   `<CertificateExportActions filename={certificate.certificate_number} disabled={certificate.is_revoked} />`
   This preserves the existing verification link and prevents export buttons for revoked credentials.
6. Keep the existing `@media print` rules only after comparing them with the included stylesheet. Avoid duplicating conflicting selectors.

## Export behavior
- JPG: waits for fonts and all certificate `<img>` elements, renders only the certificate sheet, creates a JPEG blob, then triggers a browser download. Cross-origin images must permit CORS; an external QR image that does not permit CORS can cause export to fail rather than silently generate a blank image.
- PDF: opens the browser print dialog. Select **Save as PDF**, **Landscape**, and **A4**. Enable background graphics if the browser offers that option.
- Revoked credentials: buttons are disabled when `disabled` is true. Existing revoked overlay/notice remains the source of truth.

## Verification status
The included tests check the component and CSS contracts only. They do not prove live browser rendering, image export, or deployed-site behavior. Run the test file in the project's existing test workflow and verify JPG/PDF output in a browser before release.
