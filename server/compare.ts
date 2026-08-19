import type { FieldResult, LabelFields, VerificationResult, Verdict } from '../shared/types.js';

const statutoryWarningText = 'GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. (2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS.';

type Comparator = (applicationValue: string | null, labelValue: string | null) => Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'>;

const comparators: Record<keyof LabelFields, Comparator> = {
  brandName: compareBrandName,
  classType: compareClassType,
  alcoholContent: compareAlcoholContent,
  netContents: compareNetContents,
  producerNameAddress: compareProducerNameAddress,
  countryOfOrigin: compareCountryOfOrigin,
  governmentWarning: compareGovernmentWarning,
};

export function compare(application: LabelFields, label: LabelFields): VerificationResult {
  const fields = (Object.keys(comparators) as (keyof LabelFields)[]).map((field) => ({
    field,
    applicationValue: application[field],
    labelValue: label[field],
    ...comparators[field](application[field], label[field]),
  }));
  const rollup: Verdict = fields.some(({ verdict }) => verdict === 'mismatch')
    ? 'mismatch'
    : fields.some(({ verdict }) => verdict === 'needs_review')
      ? 'needs_review'
      : 'match';
  return { id: crypto.randomUUID(), rollup, fields };
}

function compareBrandName(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Brand name is missing from one side.' };
  if (normalize(applicationValue) === normalize(labelValue)) return { verdict: 'match', reason: 'Brand name matches.' };
  return { verdict: 'mismatch', reason: 'Brand name does not match.' };
}

function compareClassType(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Class or type is missing from one side.' };
  if (normalize(applicationValue) === normalize(labelValue)) return { verdict: 'match', reason: 'Class or type matches.' };
  return { verdict: 'mismatch', reason: 'Class or type does not match.' };
}

function compareAlcoholContent(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Alcohol content is missing from one side.' };
  const applicationAbv = applicationValue.match(/\d+(?:\.\d+)?(?=\s*%)/)?.[0];
  const labelAbv = labelValue.match(/\d+(?:\.\d+)?(?=\s*%)/)?.[0];
  if (!applicationAbv || !labelAbv) return { verdict: 'needs_review', reason: 'Alcohol content could not be read clearly.' };
  if (Number(applicationAbv) === Number(labelAbv)) return { verdict: 'match', reason: 'Alcohol content matches.' };
  return { verdict: 'mismatch', reason: 'Alcohol content does not match.' };
}

function compareNetContents(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Net contents are missing from one side.' };
  if (normalize(applicationValue) === normalize(labelValue)) return { verdict: 'match', reason: 'Net contents match.' };
  return { verdict: 'mismatch', reason: 'Net contents do not match.' };
}

function compareProducerNameAddress(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Producer name or address is missing from one side.' };
  if (normalize(applicationValue) === normalize(labelValue)) return { verdict: 'match', reason: 'Producer name and address match.' };
  return { verdict: 'mismatch', reason: 'Producer name or address does not match.' };
}

function compareCountryOfOrigin(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!applicationValue || !labelValue) return { verdict: 'needs_review', reason: 'Country of origin is missing from one side.' };
  if (normalize(applicationValue) === normalize(labelValue)) return { verdict: 'match', reason: 'Country of origin matches.' };
  return { verdict: 'mismatch', reason: 'Country of origin does not match.' };
}

function compareGovernmentWarning(applicationValue: string | null, labelValue: string | null): Omit<FieldResult, 'field' | 'applicationValue' | 'labelValue'> {
  if (!labelValue) return { verdict: 'mismatch', reason: 'Government warning is missing from the label.' };
  if (!/^\s*GOVERNMENT WARNING\b/.test(labelValue)) return { verdict: 'mismatch', reason: 'GOVERNMENT WARNING must appear in capital letters.' };
  const expected = applicationValue || statutoryWarningText;
  const expectedStatement = expected.replace(/^\s*government warning\s*:?[\s]*/i, '');
  const labelStatement = labelValue.replace(/^\s*GOVERNMENT WARNING\s*:?[\s]*/, '');
  if (normalize(expectedStatement) === normalize(labelStatement)) {
    return { verdict: 'match', reason: 'Government warning wording and capitalization match.' };
  }
  return { verdict: 'mismatch', reason: 'Government warning does not match.' };
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
