const API = 'http://localhost:4000/api';
const WEB = 'http://localhost:3100';

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.headers || {}),
    },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function main() {
  const login = await req('/auth/login', {
    method: 'POST',
    body: {
      email: 'admin@horizon-demo.fr',
      password: 'Demo-Autocar-OS-2026!',
    },
  });
  if (!login.json?.accessToken) {
    console.error('LOGIN FAIL', login);
    process.exit(1);
  }
  const token = login.json.accessToken;
  console.log('login ok');

  const gets = [
    '/prep-payroll/rules',
    '/workshop/alerts',
    '/workshop/parts',
    '/workshop/fuel',
    '/quality/classifications',
    '/quality/stats',
    '/analytics/overview',
    '/budgets',
    '/client-requests',
  ];
  for (const p of gets) {
    const r = await req(p, { token });
    console.log(r.status, p);
  }

  const pub = await req('/public/quote-requests', {
    method: 'POST',
    body: {
      contactName: 'Test Smoke',
      email: 'smoke@example.com',
      origin: 'Lyon',
      destination: 'Grenoble',
      passengers: 20,
    },
  });
  console.log(pub.status, 'public/quote-requests', pub.json);

  const compute = await req('/prep-payroll/compute', {
    method: 'POST',
    token,
    body: {
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
    },
  });
  console.log(compute.status, 'compute', compute.json);

  const exp = await req('/prep-payroll/export', {
    method: 'POST',
    token,
    body: { yearMonth: '2026-10' },
  });
  console.log(exp.status, 'export', exp.json?.status || exp.json?.message || exp.json);

  const exp2 = await req('/prep-payroll/export', {
    method: 'POST',
    token,
    body: { yearMonth: '2026-10' },
  });
  console.log(exp2.status, 'export-dup', exp2.json?.message || exp2.json);

  const mfa = await req('/auth/mfa/setup', { method: 'POST', token, body: {} });
  console.log(mfa.status, 'mfa', mfa.json?.demoCode ? `code=${mfa.json.demoCode}` : mfa.json);

  const vehicles = await req('/vehicles', { token });
  const vid = vehicles.json?.[0]?.id;
  const wo = await req('/workshop/work-orders', {
    method: 'POST',
    token,
    body: {
      vehicleId: vid,
      diagnosis: 'DEMO smoke',
      tasks: [{ label: 'Diag', hours: 1 }],
    },
  });
  console.log(wo.status, 'wo', wo.json?.number || wo.json);

  const reqs = await req('/client-requests', { token });
  const rid =
    reqs.json?.find((x) => x.status === 'new')?.id || reqs.json?.[0]?.id;
  const conv = await req(`/client-requests/${rid}/convert`, {
    method: 'POST',
    token,
  });
  console.log(conv.status, 'convert', conv.json?.quote?.number || conv.json);

  const budgets = await req('/budgets', { token });
  const bid = budgets.json?.[0]?.id;
  const cmp = await req(`/budgets/${bid}/compare`, { token });
  console.log(
    cmp.status,
    'budget-compare',
    `${cmp.json?.lines?.length || 0} lines margin=${cmp.json?.overview?.marginEst}`,
  );

  for (const p of [
    '/login',
    '/client',
    '/app/prep-payroll',
    '/app/workshop',
    '/app/analytics',
    '/app/security',
    '/app/quality',
    '/app/client-requests',
  ]) {
    const res = await fetch(`${WEB}${p}`);
    console.log(res.status, `web${p}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
