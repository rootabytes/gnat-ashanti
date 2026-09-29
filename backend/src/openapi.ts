import { z } from 'zod';
import * as adminRoutes from './routes/admin';
import * as districtRoutes from './routes/district';
import * as localRoutes from './routes/local';
import * as publicRoutes from './routes/public';
import { unitsSchema } from './services';

// OpenAPI 3.1 description of the API, built from the same zod schemas the routes
// validate with, so request bodies cannot drift from the code. test/api.test.ts
// fails if a route exists that is not listed here.

type Auth = 'none' | 'district' | 'local' | 'admin';
interface Op {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  auth: Auth;
  body?: z.ZodType;
  file?: boolean;
  produces?: string;
  query?: Record<string, string>;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const op = (method: Op['method'], path: string, auth: Auth, summary: string, extra: Partial<Op> = {}): Op => ({
  method,
  path,
  auth,
  summary,
  ...extra,
});

export const OPERATIONS: Op[] = [
  op('get', '/api/health', 'none', 'Health check (includes the database)'),
  op('get', '/api/openapi.json', 'none', 'This document'),
  op('get', '/api/meta', 'none', 'Workplace categories, open regions, and whether this is the demo site'),
  op('get', '/api/units-template.xlsx', 'none', 'Excel template for importing workplaces', { produces: XLSX }),
  op('get', '/api/regions/{id}/political-districts', 'none', 'Political administrative districts of a region'),
  op('post', '/api/register', 'none', 'A District Chairman registers a district and receives its access code', {
    body: publicRoutes.registerSchema,
  }),
  op('post', '/api/access', 'none', 'Sign in with a district or local access code', { body: publicRoutes.accessSchema }),

  op('get', '/api/district/me', 'district', 'The district, its political districts and its locals'),
  op('patch', '/api/district/me', 'district', "Edit the chairman's details and remarks", { body: districtRoutes.detailsSchema }),
  op('put', '/api/district/political-districts', 'district', 'Replace the political districts covered', {
    body: districtRoutes.politicalSchema,
  }),
  op('post', '/api/district/locals', 'district', 'Add a local (creates its access code)', { body: districtRoutes.localSchema }),
  op('patch', '/api/district/locals/{id}', 'district', 'Edit a local', { body: districtRoutes.localSchema.partial({ name: true }) }),
  op('delete', '/api/district/locals/{id}', 'district', 'Delete a local'),
  op('post', '/api/district/locals/{id}/reset-code', 'district', "Give a local a new code (signs out the old one's devices)"),
  op('get', '/api/district/locals/{id}', 'district', 'A local, to fill on its chairman’s behalf'),
  op('put', '/api/district/locals/{id}/units', 'district', "Replace a local's workplaces", { body: unitsSchema }),
  op('post', '/api/district/units/import', 'district', 'Read an Excel/CSV list of workplaces (nothing is saved)', { file: true }),
  op('post', '/api/district/locals/{id}/submit', 'district', 'Submit a local on its chairman’s behalf'),
  op('post', '/api/district/locals/{id}/reopen', 'district', 'Reopen a submitted local'),
  op('post', '/api/district/submit', 'district', 'Submit the district'),
  op('post', '/api/district/reopen', 'district', 'Reopen the submitted district'),

  op('get', '/api/local/me', 'local', 'The local and its workplaces'),
  op('patch', '/api/local/me', 'local', "Edit the chairman's details and remarks", { body: localRoutes.detailsSchema }),
  op('put', '/api/local/units', 'local', 'Replace the workplaces', { body: unitsSchema }),
  op('post', '/api/local/units/import', 'local', 'Read an Excel/CSV list of workplaces (nothing is saved)', { file: true }),
  op('post', '/api/local/submit', 'local', 'Submit the local'),
  op('post', '/api/local/reopen', 'local', 'Reopen the submitted local'),

  op('post', '/api/admin/login', 'none', 'Admin sign-in with email or phone number', { body: adminRoutes.loginSchema }),
  op('get', '/api/admin/me', 'admin', 'The signed-in admin and the regions they can see'),
  op('patch', '/api/admin/me', 'admin', 'Update your own name, email and phone (returns a fresh token)', {
    body: adminRoutes.profileSchema,
  }),
  op('get', '/api/admin/overview', 'admin', 'Dashboard figures'),
  op('get', '/api/admin/duplicates', 'admin', 'Workplaces listed under more than one local'),
  op('get', '/api/admin/tree', 'admin', 'Region → districts → locals → workplaces'),
  op('get', '/api/admin/districts/{id}', 'admin', 'A district with codes and workplaces'),
  op('get', '/api/admin/locals/{id}', 'admin', 'A local with its code and workplaces'),
  op('post', '/api/admin/districts', 'admin', 'Create a district', { body: adminRoutes.createDistrictSchema }),
  op('patch', '/api/admin/districts/{id}', 'admin', 'Edit a district', { body: adminRoutes.editDistrictSchema }),
  op('delete', '/api/admin/districts/{id}', 'admin', 'Delete a district and everything under it'),
  op('post', '/api/admin/districts/{id}/status', 'admin', 'Approve, return (with a note) or reopen a district', {
    body: adminRoutes.statusSchema,
  }),
  op('post', '/api/admin/locals/{id}/status', 'admin', 'Approve, return (with a note) or reopen a local', {
    body: adminRoutes.statusSchema,
  }),
  op('post', '/api/admin/districts/{id}/approve-all', 'admin', 'Approve a district and all its locals'),
  op('delete', '/api/admin/locals/{id}', 'admin', 'Delete a local'),
  op('post', '/api/admin/districts/{id}/reset-code', 'admin', 'Give a district a new code'),
  op('post', '/api/admin/locals/{id}/reset-code', 'admin', 'Give a local a new code'),
  op('get', '/api/admin/codes', 'admin', 'Every access code in the region'),
  op('get', '/api/admin/audit', 'admin', 'Activity log', { query: { limit: 'Rows to return (at most 500).' } }),
  op('patch', '/api/admin/regions/{id}', 'admin', 'Registration key, open/close, political regions', { body: adminRoutes.regionSchema }),
  op('get', '/api/admin/political-districts', 'admin', "The region's political districts"),
  op('post', '/api/admin/political-districts', 'admin', 'Add a political district', {
    body: adminRoutes.politicalDistrictSchema,
  }),
  op('delete', '/api/admin/political-districts/{id}', 'admin', 'Delete an unused political district'),
  op('post', '/api/admin/password', 'admin', 'Change your password', { body: adminRoutes.passwordSchema }),
  op(
    'get',
    '/api/admin/system',
    'admin',
    'System status: database, version, regions open, admin accounts (super admin only; no regional data)',
  ),
  op('get', '/api/admin/activity', 'admin', "The super admin's own actions and admin account events (super admin only)", {
    query: { limit: 'Rows to return (at most 500).' },
  }),
  op('get', '/api/admin/admins', 'admin', 'List admins (super admin only)'),
  op('post', '/api/admin/admins', 'admin', 'Add an admin; returns a temporary password to send them (super admin only)', {
    body: adminRoutes.createAdminSchema,
  }),
  op('post', '/api/admin/admins/{id}/reset-password', 'admin', 'Issue a new temporary password (super admin only)'),
  op('delete', '/api/admin/admins/{id}', 'admin', 'Remove an admin (super admin only)'),
  op('get', '/api/admin/export.xlsx', 'admin', 'Excel workbook of the region', { produces: XLSX }),
  op('get', '/api/admin/export.csv', 'admin', 'CSV of districts, locals or workplaces', {
    produces: 'text/csv',
    query: { level: 'districts, locals or units (default).' },
  }),
  op('get', '/api/admin/report.pdf', 'admin', 'PDF report of the region', { produces: 'application/pdf' }),

  op('get', '/api/demo', 'none', 'Demo site only: sign-in details for every demo role'),
  op('post', '/api/demo/reset', 'none', 'Demo site only: restore the demo data'),
];

const TAGS = ['district', 'local', 'admin', 'demo'];
const jsonSchema = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' });

export function openApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const o of OPERATIONS) {
    const params = [
      ...(o.path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }] : []),
      ...Object.entries(o.query ?? {}).map(([name, description]) => ({
        name,
        in: 'query',
        required: false,
        description,
        schema: { type: 'string' },
      })),
    ];
    (paths[o.path] ??= {})[o.method] = {
      summary: o.summary,
      tags: [TAGS.includes(o.path.split('/')[2]) ? o.path.split('/')[2] : 'public'],
      security: o.auth === 'none' ? [] : [{ [o.auth]: [] }],
      ...(params.length ? { parameters: params } : {}),
      ...(o.body ? { requestBody: { required: true, content: { 'application/json': { schema: jsonSchema(o.body) } } } } : {}),
      ...(o.file
        ? {
            requestBody: {
              required: true,
              description: '.xlsx or .csv, at most 2 MB',
              content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
            },
          }
        : {}),
      responses: {
        200: o.produces
          ? { description: 'File', content: { [o.produces]: { schema: { type: 'string', format: 'binary' } } } }
          : { description: 'OK' },
        default: { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      },
    };
  }
  const bearer = (description: string) => ({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description });
  return {
    openapi: '3.1.0',
    info: {
      title: 'GNAT Mapping API',
      version: '1.1.0',
      description: 'Maps GNAT regions, districts, locals and basic units. Built and operated by Rootabytes (https://rootabytes.com).',
    },
    paths,
    components: {
      securitySchemes: {
        district: bearer('Token from POST /api/access with a district code'),
        local: bearer('Token from POST /api/access with a local code'),
        admin: bearer('Token from POST /api/admin/login'),
      },
      schemas: {
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' }, details: {} } },
      },
    },
  };
}
