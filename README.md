# RuffNeck Learn — Certificate JPG Download Fix

This targeted fix addresses the JPG download failure in the current certificate source.

## Confirmed issues in `main`

- The certificate page uses an externally hosted QR image from `api.qrserver.com`. Cross-origin image capture can cause `html-to-image` rasterization to fail.
- The current JPG component waits asynchronously and then triggers a programmatic download. Some browsers, particularly Safari/mobile Safari, may ignore that click after asynchronous work finishes.
- The existing component uses a generic filename, which makes downloads harder to identify.

## Files

- `src/components/CertificateJpgButton.tsx` — complete replacement component.

No page replacement is required. The current `src/app/student/certificates/[certificateId]/page.tsx` already imports and renders `CertificateJpgButton`, and the current `package.json` already lists both `html-to-image` and `qrcode.react` as dependencies.

## What the replacement changes

- Reads the actual verification URL from the existing QR image's `data` query parameter.
- Renders that same QR locally as an inline SVG using the already-installed `qrcode.react` package.
- Temporarily replaces the external QR image with the local SVG only while capturing the certificate, then restores the original page element.
- Waits for fonts and remaining certificate images before capture.
- Explicitly encodes JPEG and rejects an empty or incorrectly typed blob.
- Uses a Blob URL rather than a large base64 data URL.
- Names the file using its certificate number when available.
- Shows a visible `Download JPG file` link after the image is generated, for browsers that ignore the automatic download click.
- Keeps the existing Print / Save PDF action unchanged.

## Apply through GitHub

1. Create a branch from `main`, for example `fix/certificate-jpg-download`.
2. Replace `src/components/CertificateJpgButton.tsx` with the complete file in this package.
3. Do not modify `package.json`: the current `main` already includes `html-to-image` and `qrcode.react`.
4. Commit the replacement to the branch and inspect the Vercel preview before merging.

## Verification checklist

1. Open a valid, non-revoked certificate.
2. Click Download JPG.
3. Confirm the button indicates progress, then the success message and fallback link appear.
4. Open the JPG and check the holder name, course, certificate number, logos, seal, signature and QR code.
5. Confirm the QR code resolves to the certificate verification URL.
6. Test Chrome/Edge and, if applicable, Safari/iOS Safari.
7. Test a revoked certificate and confirm the JPG button remains hidden by the existing page logic.
8. Confirm Print / Save PDF and public verification still work.

## Verification status

This package is a source-level replacement based on the public `main` component and its certificate page. It has not been built against the full repository or tested against production certificate records. Do not merge until Vercel preview build and a real JPG download both pass.
