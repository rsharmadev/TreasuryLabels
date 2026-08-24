import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LabelFields, VerificationResult } from '../../shared/types';
import sampleOne from '../../samples/canyon-oak.json';
import sampleTwo from '../../samples/harbor-gin.json';
import sampleThree from '../../samples/sierra-rosa.json';
import './styles.css';

type Row = { name: string; applicationId?: string; result?: VerificationResult; error?: string };

const emptyApplication: LabelFields = {
  brandName: null,
  classType: null,
  alcoholContent: null,
  netContents: null,
  producerNameAddress: null,
  countryOfOrigin: null,
  governmentWarning: null,
};

const labels: Record<keyof LabelFields, string> = {
  brandName: 'Brand name',
  classType: 'Class / type',
  alcoholContent: 'Alcohol content',
  netContents: 'Net contents',
  producerNameAddress: 'Producer name and address',
  countryOfOrigin: 'Country of origin',
  governmentWarning: 'Government warning',
};

const applicationFields: (keyof LabelFields)[] = ['brandName', 'classType', 'alcoholContent', 'netContents', 'producerNameAddress', 'countryOfOrigin'];
const canyonOakImage = new URL('../../samples/batch/labels/intake-07.png', import.meta.url).href;
const harborGinImage = new URL('../../samples/harbor-dry-gin.png', import.meta.url).href;
const sierraRosaImage = new URL('../../samples/batch/labels/archive-scan.png', import.meta.url).href;
const batchCsv = new URL('../../samples/batch/applications.csv', import.meta.url).href;
const batchImages = [
  { url: canyonOakImage, name: 'intake-07.png' },
  { url: new URL('../../samples/batch/labels/merchant-photo.png', import.meta.url).href, name: 'merchant-photo.png' },
  { url: sierraRosaImage, name: 'archive-scan.png' },
  { url: new URL('../../samples/batch/labels/unknown-item.png', import.meta.url).href, name: 'unknown-item.png' },
];

const samples = [
  { application: sampleOne as LabelFields, imageUrl: canyonOakImage, imageName: 'canyon-oak-sample.png' },
  { application: sampleTwo as LabelFields, imageUrl: harborGinImage, imageName: 'harbor-dry-gin-sample.png' },
  { application: sampleThree as LabelFields, imageUrl: sierraRosaImage, imageName: 'sierra-rosa-sample.png' },
];

function value(value: string | null) {
  return value || '—';
}

async function fileFromUrl(url: string, name: string, type: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load sample file.');
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || type });
}

function Results({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  const needsAttention = rows.filter((row) => row.error || row.result?.rollup !== 'match').length;
  const clear = rows.length - needsAttention;
  return <section className="results" aria-live="polite">
    <h2>Results</h2>
    <p className="summary"><strong>{needsAttention} {needsAttention === 1 ? 'label needs' : 'labels need'} attention</strong> · {clear} {clear === 1 ? 'label is' : 'labels are'} clear</p>
    <div className="table-wrap">
      <table>
        <thead><tr><th>Label</th><th>Result</th><th>Details</th></tr></thead>
        <tbody>{rows.map((row, index) => <>
          <tr key={row.name}>
            <td>{row.name}{row.applicationId && <small className="application-id">Application: {row.applicationId}</small>}</td>
            <td>{row.error ? <span className="badge mismatch">Could not check</span> : <span className={`badge ${row.result!.rollup}`}>{row.result!.rollup.replace('_', ' ')}</span>}</td>
            <td>{row.error ? row.error : <button className="text-button" onClick={() => setOpen(open === String(index) ? null : String(index))}>{open === String(index) ? 'Hide' : 'Show'}</button>}</td>
          </tr>
          {open === String(index) && row.result && <tr key={`${row.name}-detail`}><td colSpan={3} className="detail"><table>
            <thead><tr><th>Field</th><th>Application</th><th>Label</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>{row.result.fields.map((field) => <tr key={field.field}><td>{labels[field.field]}</td><td>{value(field.applicationValue)}</td><td>{value(field.labelValue)}</td><td><span className={`badge ${field.verdict}`}>{field.verdict.replace('_', ' ')}</span></td><td>{field.reason}</td></tr>)}</tbody>
          </table></td></tr>}
        </>)}</tbody>
      </table>
    </div>
  </section>;
}

function App() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [application, setApplication] = useState<LabelFields>(emptyApplication);
  const [image, setImage] = useState<File | null>(null);
  const [sampleImageLoaded, setSampleImageLoaded] = useState(false);
  const [csv, setCsv] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [batchSampleLoaded, setBatchSampleLoaded] = useState(false);
  const [sample, setSample] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  const loadSample = async () => {
    const selected = samples[sample];
    setApplication(selected.application);
    try {
      setImage(await fileFromUrl(selected.imageUrl, selected.imageName, 'image/png'));
      setSampleImageLoaded(true);
      setMessage('Sample application and label image loaded.');
    } catch {
      setImage(null);
      setSampleImageLoaded(false);
      setMessage('Sample application loaded, but its image could not be loaded.');
    }
  };

  const loadBatchSample = async () => {
    try {
      const [sampleCsv, ...sampleImages] = await Promise.all([
        fileFromUrl(batchCsv, 'applications.csv', 'text/csv'),
        ...batchImages.map((image) => fileFromUrl(image.url, image.name, 'image/png')),
      ]);
      setCsv(sampleCsv);
      setImages(sampleImages);
      setBatchSampleLoaded(true);
      setMessage('Sample batch loaded. Image filenames are deliberately unrelated to application IDs.');
    } catch {
      setMessage('Sample batch could not be loaded.');
    }
  };

  const verifySingle = async () => {
    if (!image) return setMessage('Choose one label image first.');
    setWorking(true); setMessage('');
    const body = new FormData();
    body.append('application', JSON.stringify(application)); body.append('image', image);
    try {
      const response = await fetch('/api/verify', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRows([{ name: image.name, result: data.result }]);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Verification failed.'); }
    finally { setWorking(false); }
  };

  const verifyBatch = async () => {
    if (!csv || !images.length) return setMessage('Choose a CSV and label images first.');
    setWorking(true); setMessage('');
    const body = new FormData();
    body.append('csv', csv); images.forEach((file) => body.append('images', file));
    try {
      const response = await fetch('/api/verify-batch', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const nextRows = data.results.map((item: { applicationId?: string; filename: string; result?: VerificationResult; error?: string }) => ({ name: item.filename, applicationId: item.applicationId, result: item.result, error: item.error }));
      nextRows.sort((left: Row, right: Row) => Number(!left.error && left.result?.rollup === 'match') - Number(!right.error && right.result?.rollup === 'match'));
      setRows(nextRows);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Batch verification failed.'); }
    finally { setWorking(false); }
  };

  return <main>
    <header><p className="eyebrow">Treasury labels</p><h1>Check a label</h1><p>Compare application details with what is printed on the bottle.</p></header>
    <div className="mode" role="group" aria-label="Check type"><button className={mode === 'single' ? 'selected' : ''} onClick={() => { setMode('single'); setRows([]); setMessage(''); }}>One label</button><button className={mode === 'batch' ? 'selected' : ''} onClick={() => { setMode('batch'); setRows([]); setMessage(''); }}>Many labels</button></div>
    {mode === 'single' ? <section className="single">
      <div><div className="sample"><label>Example application<select value={sample} onChange={(event) => setSample(Number(event.target.value))}>{samples.map((item, index) => <option value={index} key={index}>{item.application.brandName}</option>)}</select></label><button className="secondary" onClick={loadSample}>Load sample</button></div><h2>Application details</h2><div className="form">{applicationFields.map((field) => <label key={field}>{labels[field]}<input value={application[field] || ''} onChange={(event) => setApplication({ ...application, [field]: event.target.value || null })} /></label>)}</div></div>
      <div className="upload"><h2>Label image</h2><label className="dropzone"><input type="file" accept="image/*" onChange={(event) => { setImage(event.target.files?.[0] || null); setSampleImageLoaded(false); }} /><span>{image ? `${image.name} — click to replace` : 'Choose an image'}</span><small>{sampleImageLoaded ? 'Sample label loaded' : 'JPG, PNG, or HEIC'}</small></label></div>
    </section> : <section className="batch"><div className="sample"><div><strong>Example batch</strong><small>One CSV and four label images</small></div><button className="secondary" onClick={loadBatchSample}>Load sample batch</button></div><h2>Upload files</h2><div className="batch-inputs"><label className="dropzone"><input type="file" accept=".csv,text/csv" onChange={(event) => { setCsv(event.target.files?.[0] || null); setBatchSampleLoaded(false); }} /><span>{csv ? `${csv.name} — click to replace` : 'Choose application CSV'}</span><small>{batchSampleLoaded ? 'Sample CSV loaded' : 'Must include applicationId'}</small></label><label className="dropzone"><input type="file" accept="image/*" multiple onChange={(event) => { setImages(Array.from(event.target.files || [])); setBatchSampleLoaded(false); }} /><span>{images.length ? `${images.length} image${images.length === 1 ? '' : 's'} selected — click to replace` : 'Choose label images'}</span><small>{batchSampleLoaded ? 'Sample labels loaded' : 'Image filenames can be anything'}</small></label></div></section>}
    {message && <p className="message" role="alert">{message}</p>}
    <button className="primary" disabled={working} onClick={mode === 'single' ? verifySingle : verifyBatch}>{working ? 'Checking labels…' : mode === 'single' ? 'Check label' : 'Check labels'}</button>
    <Results rows={rows} />
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
