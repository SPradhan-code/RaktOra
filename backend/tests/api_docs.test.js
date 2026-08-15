const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const app = require('../server');

describe('📚 OpenAPI 3.0 & Swagger UI Documentation Suite', () => {
  let server;
  let baseUrl;

  before(() => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
  });

  test('1. [OpenAPI Specification JSON] GET /api/docs/swagger.json returns valid OpenAPI 3.0.3 spec', async () => {
    const res = await fetch(`${baseUrl}/api/docs/swagger.json`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type').includes('application/json'), true);

    const spec = await res.json();
    assert.strictEqual(spec.openapi, '3.0.3');
    assert.strictEqual(spec.info.title, 'RaktOra REST API');
    assert.ok(spec.components.securitySchemes.bearerAuth, 'bearerAuth scheme must be defined');

    // Verify key documented paths exist
    assert.ok(spec.paths['/health'], 'Must document /health');
    assert.ok(spec.paths['/features'], 'Must document /features');
    assert.ok(spec.paths['/auth/register'], 'Must document /auth/register');
    assert.ok(spec.paths['/auth/login'], 'Must document /auth/login');
    assert.ok(spec.paths['/auth/me'], 'Must document /auth/me');
    assert.ok(spec.paths['/donors/search'], 'Must document /donors/search');
    assert.ok(spec.paths['/requests'], 'Must document /requests');
    assert.ok(spec.paths['/requests/{id}/fulfill'], 'Must document /requests/{id}/fulfill');
    assert.ok(spec.paths['/bloodbanks'], 'Must document /bloodbanks');
    assert.ok(spec.paths['/bloodunits/fefo-issue'], 'Must document /bloodunits/fefo-issue');
    assert.ok(spec.paths['/appointments'], 'Must document /appointments');
    assert.ok(spec.paths['/camps'], 'Must document /camps');
    assert.ok(spec.paths['/admin/metrics'], 'Must document /admin/metrics');
  });

  test('2. [Interactive Swagger UI Page] GET /api/docs returns HTML documentation interface', async () => {
    const res = await fetch(`${baseUrl}/api/docs`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type').includes('text/html'), true);

    const html = await res.text();
    assert.ok(html.includes('RaktOra REST API Documentation'));
    assert.ok(html.includes('/api/docs/swagger.json'));
    assert.ok(html.includes('swagger-ui'));
  });

  test('3. [Schema Definitions] Schemas define accurate properties without secret leaks', async () => {
    const res = await fetch(`${baseUrl}/api/docs/swagger.json`);
    const spec = await res.json();

    const userSchema = spec.components.schemas.User;
    assert.ok(userSchema);
    assert.strictEqual(userSchema.properties.password_hash, undefined, 'password_hash must NOT be in user schema');

    const registerSchema = spec.components.schemas.RegisterRequest;
    assert.ok(registerSchema.required.includes('email'));
    assert.ok(registerSchema.required.includes('password'));
  });
});
