# Treasury Labels

A standalone prototype that helps TTB compliance agents compare alcohol-label artwork against application details. It extracts visible label text with Gemini, applies deterministic comparison rules, and highlights items that match, mismatch, or need human review.

**Live app:** https://ttblabeling.up.railway.app

## Run locally

Requires Node.js 22+ and a Gemini API key.

```bash
npm install
export GEMINI_API_KEY="your-key"
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies API requests to the Express server on port 3001.

To run the production build locally:

```bash
npm run build
npm run start
```

Then open `http://localhost:3001`.

## How it works

### Check one label

1. Enter the application details (or load a sample application).
2. Upload a JPG, PNG, or HEIC label image.
3. Select **Check label** to see a per-field result and explanation.

### Check many labels

Upload a CSV and up to 300 label images. Image filenames can be anything. The app extracts a label's product signature—brand name, class/type, ABV, and net contents—and uses it to find the matching CSV row.

Each CSV row needs an `applicationId` so the matched record can be shown in results:

```csv
applicationId,brandName,classType,alcoholContent,netContents,producerNameAddress,countryOfOrigin
cola-102,Canyon Oak Bourbon,Kentucky Straight Bourbon Whiskey,45% Alc. by Vol.,750 mL,"Canyon Oak Distillery, Louisville, KY",United States
```

`applicationId` is required. Other columns map to the application fields and may be blank when information is unavailable. If more than one row has the same product signature, or no row matches it, that image is returned for review rather than guessed.

## Approach

- The browser sends the application record and label image to an Express API.
- Sharp rotates and downsizes each image before Gemini extracts only visible text into a fixed JSON schema.
- Deterministic server-side rules compare brand name, class/type, ABV, net contents, producer details, country of origin, and the statutory government warning.
- Batch images are processed with a concurrency limit of three and are sorted so attention items appear first.

The model is used only for visual text extraction. It does not decide compliance outcomes; the comparison rules produce the final `match`, `mismatch`, or `needs review` status.

## Prototype assumptions and limitations

- This is a standalone proof of concept; it does not integrate with COLA, persist uploads, or include user accounts.
- Image and application data are handled in memory for the duration of a request. Do not use it for production-sensitive records without adding the appropriate retention, security, and infrastructure controls.
- A `needs review` result is intentional: it keeps unclear or missing text with a human agent rather than guessing.
- The government warning comparison checks the statutory wording and capitalization of `GOVERNMENT WARNING:`. Visual formatting requirements such as bold presentation remain an appropriate human-review step in this prototype.
- The app accepts individual images up to 10 MB. For large production batches, use streamed or temporary-file uploads rather than in-memory upload storage.

## Technology

- React + Vite + TypeScript
- Express + Multer
- Gemini API (`gemini-3.5-flash-lite`) for structured image extraction
- Sharp for image normalization
