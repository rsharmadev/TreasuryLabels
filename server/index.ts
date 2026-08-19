import { parse } from 'csv-parse/sync';
import cors from 'cors';
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

app.use(cors());
app.use(express.json());

function asApplication(value: unknown): LabelFields {
  const record = typeof value === 'string' ? JSON.parse(value) : value;
  if (!record || typeof record !== 'object') throw new Error('Application record is required.');
  return Object.fromEntries(fields.map((field) => [field, (record as Record<string, unknown>)[field] || null])) as LabelFields;
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
    const uploads = req.files as { csv?: Express.Multer.File[]; images?: Express.Multer.File[] };
    const csv = uploads.csv?.[0];
    const images = uploads.images ?? [];
    if (!csv || !images.length) throw new Error('A CSV and at least one image are required.');
    const records = parse(csv.buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    if (!records.every((record) => record.applicationId)) throw new Error('CSV must include an applicationId column.');
    const applications = new Map(records.map((record) => [record.applicationId, asApplication(record)]));
    const results = await concurrentMap(images, 3, async (image) => {
      const applicationId = path.parse(image.originalname).name;
      const application = applications.get(applicationId);
      if (!application) return { applicationId, filename: image.originalname, error: 'No CSV application matches this filename.' };
      try {
        const label = await extractLabel(image.buffer);
        return { applicationId, filename: image.originalname, result: compare(application, label), label };
      } catch {
        return { applicationId, filename: image.originalname, error: 'Could not check this image. Try a clearer image or retry it later.' };
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
