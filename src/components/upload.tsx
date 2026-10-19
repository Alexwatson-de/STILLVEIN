'use client';
import { useRef, useState } from 'react';
import { Asset } from '@/lib/schema';
import { api, clientAuth } from '@/lib/client';
export function Upload({
  productId,
  kind,
  onUploaded,
}: {
  productId: string;
  kind: 'gallery' | 'textures' | 'site';
  onUploaded: (asset: Asset) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const xhr = useRef<XMLHttpRequest | null>(null);
  async function upload(file: File) {
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760) {
      setError('Choose a JPEG, PNG or WebP image up to 10 MB.');
      return;
    }
    setBusy(true);
    setProgress(0);
    const local = URL.createObjectURL(file);
    setPreview(local);
    try {
      const authorization = await api<{ ticket: string }>(
        'admin/uploads',
        {
          method: 'POST',
          body: JSON.stringify({ productId, kind, mime: file.type, size: file.size }),
        },
        true,
      );
      const user = clientAuth().currentUser;
      if (!user) throw new Error('Please sign in again.');
      const token = await user.getIdToken();
      const asset = await new Promise<Asset>((resolve, reject) => {
        const request = new XMLHttpRequest();
        xhr.current = request;
        request.open('POST', `/api/admin/uploads/${authorization.ticket}/transfer`);
        request.setRequestHeader('Authorization', `Bearer ${token}`);
        request.setRequestHeader('Content-Type', file.type);
        request.timeout = 120000;
        request.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        request.onload = () => {
          try {
            const result = JSON.parse(request.responseText);
            if (request.status >= 200 && request.status < 300) resolve(result);
            else reject(new Error(result.error || 'Image upload failed.'));
          } catch {
            reject(
              new Error(
                'The upload service returned an invalid response. Existing images are unchanged.',
              ),
            );
          }
        };
        request.onerror = () =>
          reject(new Error('Upload connection failed. Your existing image has not changed.'));
        request.onabort = () =>
          reject(new Error('Upload cancelled. Your existing image has not changed.'));
        request.ontimeout = () =>
          reject(new Error('Upload timed out. Retry on a stable connection.'));
        request.send(file);
      });
      onUploaded({
        ...asset,
        alt: file.name.replace(/\.[^.]+$/, '').slice(0, 250) || 'Stone surface',
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      xhr.current = null;
      URL.revokeObjectURL(local);
      setPreview('');
    }
  }
  return (
    <div className="upload-box">
      <label>
        {kind === 'textures' ? 'High-resolution texture' : 'Upload image'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
      </label>
      <small className="muted">
        JPEG, PNG or WebP · up to 10 MB / 25 MP. Server-validated and signed, then stored in
        Cloudinary. Save the record to apply the replacement.
      </small>
      {preview && (
        <img
          src={preview}
          alt="Image upload preview"
          style={{ height: 90, objectFit: 'contain' }}
        />
      )}
      {busy && (
        <>
          <progress max={100} value={progress} aria-label="Upload progress" />
          <span>
            {progress}% ·{' '}
            {progress === 100 ? 'Validating and storing in Cloudinary…' : 'Transferring image…'}
          </span>
          <button type="button" className="text-link" onClick={() => xhr.current?.abort()}>
            Cancel upload
          </button>
        </>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
