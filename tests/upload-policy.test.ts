import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe('Deployment upload policy', () => {
  it('retains the local 10 MB ceiling by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAX_IMAGE_MB', '');
    vi.resetModules();
    const policy = await import('../src/lib/upload-policy');
    expect(policy.MAX_IMAGE_MB).toBe(10);
    expect(policy.MAX_IMAGE_BYTES).toBe(10485760);
  });
  it('shares the hosted 4 MB limit with server byte validation', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAX_IMAGE_MB', '4');
    vi.resetModules();
    const policy = await import('../src/lib/upload-policy');
    const { readImageBody } = await import('../src/lib/server/image-validation');
    expect(policy.MAX_IMAGE_BYTES).toBe(4194304);
    const req = new Request('http://localhost/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(policy.MAX_IMAGE_BYTES + 1),
      },
      body: new Uint8Array(1),
    });
    await expect(readImageBody(req)).rejects.toThrow('4 MB limit');
  });
  it('refuses over-limit hosted authorization before contacting the provider', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAX_IMAGE_MB', '4');
    vi.resetModules();
    const { uploadRequest } = await import('../src/lib/server/assets');
    expect(
      uploadRequest.safeParse({
        productId: 'qa',
        kind: 'textures',
        mime: 'image/jpeg',
        size: 4194305,
      }).success,
    ).toBe(false);
  });
});
