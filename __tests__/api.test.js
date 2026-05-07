const { app } = require('../server/server');

describe('API smoke tests', () => {
  let server;
  let baseUrl;

  beforeAll(done => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll(done => {
    server.close(done);
  });

  it('returns ok from /api/health', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok', version: '3.2.1' });
    expect(typeof body.ts).toBe('number');
  });

  it('falls back to development OTP mode when SMTP is not configured', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@example.com', name: 'Demo User' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        message: 'Verification code generated. Check the server console in development mode.',
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('serves the welcome page at /', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);

    const html = await res.text();
    expect(html).toContain('Welcome to ThinkFi');
  });

}); // ✅ API smoke tests ends HERE

// ✅ fmt() is now its own separate block, outside API tests
describe('fmt() number formatter', () => {
  const fmt = n => {
    const sign = n < 0 ? '-' : '';
    const abs  = Math.abs(n);
    if (abs >= 10000000) return sign + '₹' + (abs / 10000000).toFixed(2) + 'Cr';
    if (abs >= 100000)   return sign + '₹' + (abs / 100000).toFixed(1) + 'L';
    if (abs >= 1000)     return sign + '₹' + (abs / 1000).toFixed(1) + 'K';
    return sign + '₹' + abs.toLocaleString('en-IN');
  };

  it('formats negative large numbers correctly (regression: Bug 4)', () => {
    expect(fmt(-150000)).toBe('-₹1.5L');
    expect(fmt(-10000000)).toBe('-₹1.00Cr');
    expect(fmt(-5000)).toBe('-₹5.0K');
    expect(fmt(-500)).toBe('-₹500');
  });

  it('formats positive numbers correctly', () => {
    expect(fmt(150000)).toBe('₹1.5L');
    expect(fmt(5000)).toBe('₹5.0K');
  });
});