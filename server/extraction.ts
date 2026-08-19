import OpenAI from 'openai';
import sharp from 'sharp';
import type { LabelFields } from '../shared/types.js';

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['brandName', 'classType', 'alcoholContent', 'netContents', 'producerNameAddress', 'countryOfOrigin', 'governmentWarning'],
  properties: {
    brandName: { type: ['string', 'null'] },
    classType: { type: ['string', 'null'] },
    alcoholContent: { type: ['string', 'null'] },
    netContents: { type: ['string', 'null'] },
    producerNameAddress: { type: ['string', 'null'] },
    countryOfOrigin: { type: ['string', 'null'] },
    governmentWarning: { type: ['string', 'null'] },
  },
};

export async function extractLabel(imageBuffer: Buffer): Promise<LabelFields> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const image = await sharp(imageBuffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const response = await client.responses.create({
    model: 'gpt-5.6-luna',
    input: [{
      role: 'user',
      content: [
        { type: 'input_text', text: 'Read this alcohol label. Extract only text visibly present. Preserve the capitalization of the government warning. Use null when a field is absent or unclear. Never infer or guess values.' },
        { type: 'input_image', image_url: `data:image/jpeg;base64,${image.toString('base64')}`, detail: 'high' },
      ],
    }],
    text: { format: { type: 'json_schema', name: 'label_fields', strict: true, schema } },
  });
  return JSON.parse(response.output_text) as LabelFields;
}
