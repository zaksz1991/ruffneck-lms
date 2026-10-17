# RuffNeck Learn — Certificate JPG Download Fix

This package fixes the JPG export path and two related integration problems visible in the current public `main` source:

1. `CertificateJpgButton.tsx` uses `html-to-image`, but `html-to-image` is not listed in the current `package.json`.
2. `src/app/student/certificates/[certificateId]/page.tsx` renders `<CertificateJpgButton />` but the current `main` file does not import it.
3. The certificate's QR code is currently loaded from a third-party image URL. Cross-origin image capture can cause DOM-to-image export failures. Use the installed `qrcode.react` package to render the QR code locally as SVG.
4. Downloads are changed from a base64 data URL to a Blob URL, with image/font readiness checks and visible error feedback.

## Files in this ZIP

- `src/components/CertificateJpgButton.tsx` — complete replacement.
- `package.json` — complete replacement, adding `html-to-image` as a direct dependency.
- `PAGE_CHANGES.txt` — exact small changes required in the existing certificate page. Do not replace the entire 1,174-line page.

## Apply through GitHub

1. Create a branch from `main` named `fix/certificate-jpg-download`.
2. Replace `src/components/CertificateJpgButton.tsx` with the included file.
3. Replace `package.json` with the included file. The current repository source does not contain a `package-lock.json`; if your branch has acquired one since this package was prepared, update/regenerate it with the matching dependency before deployment.
4. Make the changes described in `PAGE_CHANGES.txt` to `src/app/student/certificates/[certificateId]/page.tsx`.
5. Commit these changes to the branch and check the Vercel preview before merging.

## Why these changes

- `toBlob` reduces memory use compared with a large base64 JPEG data URL.
- Appending the download link to the DOM is more compatible with browser download handling.
- The button waits for fonts and all certificate `<img>` assets before rasterizing.
- An inline SVG QR code avoids relying on a third-party QR image during canvas export.
- The existing Print / Save PDF action remains available as fallback.

## Verification checklist

1. Open a valid, non-revoked certificate.
2. Wait for all logos, seals, and signature images to load.
3. Click Download JPG; confirm the button shows progress and then a success message.
4. Open the downloaded JPG and check the full certificate, QR code, logos, signature, recipient name, scores, and certificate number.
5. Test a revoked certificate: the JPG control should remain hidden, as before.
6. Test Chrome and Edge desktop; if applicable, test Safari/mobile Safari.
7. Confirm Print / Save PDF and public certificate verification continue to work.

## Verification status

This is a targeted source-level replacement prepared against public `main` source. It has not been built against your full repository or tested against your production certificate records. Do not merge until the Vercel preview build and a real certificate JPG download both pass.
