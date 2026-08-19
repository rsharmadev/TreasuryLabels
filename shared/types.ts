export type LabelFields = {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  netContents: string | null;
  producerNameAddress: string | null;
  countryOfOrigin: string | null;
  governmentWarning: string | null;
};

export type Verdict = 'match' | 'mismatch' | 'needs_review';

export type FieldResult = {
  field: keyof LabelFields;
  applicationValue: string | null;
  labelValue: string | null;
  verdict: Verdict;
  reason: string;
  confidence?: number;
};

export type VerificationResult = {
  id: string;
  rollup: Verdict;
  fields: FieldResult[];
};
