import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import type { LabelFields } from '../shared/types.js';

export type ExtractedLabelFields = LabelFields & {
  governmentWarningPrefixBold: boolean | null;
};

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['brandName', 'classType', 'alcoholContent', 'netContents', 'producerNameAddress', 'countryOfOrigin', 'governmentWarning', 'governmentWarningPrefixBold'],
  properties: {
    brandName: { type: ['string', 'null'] },
    classType: { type: ['string', 'null'] },
    alcoholContent: { type: ['string', 'null'] },
    netContents: { type: ['string', 'null'] },
    producerNameAddress: { type: ['string', 'null'] },
    countryOfOrigin: { type: ['string', 'null'] },
    governmentWarning: { type: ['string', 'null'] },
    governmentWarningPrefixBold: { type: ['boolean', 'null'] },
  },
};

export async function extractLabel(imageBuffer: Buffer): Promise<ExtractedLabelFields> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const image = await sharp(imageBuffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const response = await client.models.generateContent({
    model: 'gemini-3.5-flash-lite',
    contents: [
      { inlineData: { mimeType: 'image/jpeg', data: image.toString('base64') } },
      { text: 'Read this alcohol label and extract only text visibly present. For brandName, copy the complete, most prominent product brand phrase word-for-word, including every word when it is split across multiple display lines. Do not shorten it. A beverage word can be part of the brandName when it belongs to that dominant display phrase. Use classType only for the separate, subordinate beverage descriptor. Preserve the capitalization of the government warning. For governmentWarningPrefixBold, return true only if the visible prefix "GOVERNMENT WARNING:" is bold, false if it is clearly not bold, and null if the visual styling cannot be determined. Use null when any text field is absent or unclear. Never infer or guess values.' },
    ],
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    },
  });
  if (!response.text) throw new Error('The extraction model returned no result.');
  return JSON.parse(response.text) as ExtractedLabelFields;
}
