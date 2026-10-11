# PDF.js 6.4.299 legacy distribution

Source: https://github.com/mozilla/pdf.js/releases/tag/v6.4.299

Archive: pdfjs-6.4.299-legacy-dist.zip

Published SHA-256 (verified before extraction):
`c894bce53b2f4c3e13141e088c89cc051a1f7118ba4a2c02ec058798ae1303d1`

The official `pdf.mjs`, `pdf.worker.mjs`, `LICENSE` and three required Japanese CMaps with their original LICENSE are copied unchanged. `UniJIS-UCS2-H.bcmap` (25,439 bytes) supports the Traders monthly reports. No viewer, sandbox, maps, rendering fonts or WASM is shipped. Extraction is text-only and disables WASM. Main and worker have the same fixed version. Legacy was selected for Safari compatibility; this is not a claim of actual iPhone testing.

All resources are served locally. PDF bytes are supplied through `data`, never a remote URL. Unrecognised fonts/formats fail validation rather than inventing values. Do not edit upstream code or remove its licences.
