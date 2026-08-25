import { parse } from 'csv-parse/sync';
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compare } from './compare.js';
import { extractLabel } from './extraction.js';
import type { LabelFields } from '../shared/types.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const fields: (keyof LabelFields)[] = ['brandName', 'classType', 'alcoholContent', 'netContents', 'producerNameAddress', 'countryOfOrigin', 'governmentWarning'];
const productFields: (keyof LabelFields)[] = ['classType', 'alcoholContent', 'netContents'];

app.use(express.json());

function asApplication(value: unknown): LabelFields {
  const record = typeof value === 'string' ? JSON.parse(value) : value;
  if (!record || typeof record !== 'object') throw new Error('Application record is required.');
  return Object.fromEntries(fields.map((field) => [field, (record as Record<string, unknown>)[field] || null])) as LabelFields;
}

function sameText(left: string | null, right: string | null): boolean {
  return Boolean(left && right && normalize(left) === normalize(right));
}

function sameAlcoholContent(left: string | null, right: string | null): boolean {
  const leftAbv = left?.match(/\d+(?:\.\d+)?(?=\s*%)/)?.[0];
  const rightAbv = right?.match(/\d+(?:\.\d+)?(?=\s*%)/)?.[0];
  return Boolean(leftAbv && rightAbv && Number(leftAbv) === Number(rightAbv));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function identifyApplication(label: LabelFields, applications: { applicationId: string; fields: LabelFields }[]) {
  if (!label.brandName) return { error: 'Could not read a brand name from this label.' };
  const brandMatches = applications.filter((application) => sameText(application.fields.brandName, label.brandName));
  const matches = brandMatches.filter((application) => productFields.every((field) => {
    if (!label[field]) return true;
    return field === 'alcoholContent'
      ? sameAlcoholContent(application.fields[field], label[field])
      : sameText(application.fields[field], label[field]);
  }));
  if (matches.length === 1) return { application: matches[0] };
  if (!matches.length) return { error: `No application matches the extracted product details for ${label.brandName}.` };
  return { error: `Multiple applications match the extracted product details for ${label.brandName}.` };
}

async function concurrentMap<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}

app.post('/api/verify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) throw new Error('One label image is required.');
    const application = asApplication(req.body.application);
    const label = await extractLabel(req.file.buffer);
    res.json({ result: compare(application, label), label });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Verification failed.' });
  }
});

app.post('/api/verify-batch', upload.fields([{ name: 'csv', maxCount: 1 }, { name: 'images', maxCount: 300 }]), async (req, res) => {
  try {
    const uploads = (req.files ?? {}) as { csv?: Express.Multer.File[]; images?: Express.Multer.File[] };
    const csv = uploads.csv?.[0];
    const images = uploads.images ?? [];
    if (!csv || !images.length) throw new Error('A CSV and at least one image are required.');
    const records = parse(csv.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    if (!records.every((record) => record.applicationId)) throw new Error('CSV must include an applicationId column.');
    const applications = records.map((record) => ({ applicationId: record.applicationId, fields: asApplication(record) }));
    const results = await concurrentMap(images, 3, async (image) => {
      try {
        const label = await extractLabel(image.buffer);
        const identified = identifyApplication(label, applications);
        if ('error' in identified) return { filename: image.originalname, error: identified.error };
        return { applicationId: identified.application.applicationId, filename: image.originalname, result: compare(identified.application.fields, label), label };
      } catch {
        return { filename: image.originalname, error: 'Could not check this image. Try a clearer image or retry it later.' };
      }
    });
    res.json({ results });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Batch verification failed.' });
  }
});

const directory = path.dirname(fileURLToPath(import.meta.url));
const client = path.resolve(directory, '../client/dist');
app.use(express.static(client));
app.get('*', (_req, res) => res.sendFile(path.join(client, 'index.html')));

app.listen(process.env.PORT || 3001);
