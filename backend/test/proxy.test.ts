import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { isCloudflare, trustProxy } from '../src/proxy';

test('Cloudflare ranges', () => {
  assert.equal(isCloudflare('162.158.10.20'), true);
  assert.equal(isCloudflare('::ffff:104.21.90.100'), true);
  assert.equal(isCloudflare('2606:4700:3035::6815:5a64'), true);
  assert.equal(isCloudflare('41.66.200.7'), false);
  assert.equal(isCloudflare('10.0.0.5'), false);
});

test('req.ip is the visitor, through Railway alone or Cloudflare then Railway', async () => {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.get('/ip', (req, res) => res.send(req.ip));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ip`;
  const ip = async (xff: string) => (await fetch(url, { headers: { 'X-Forwarded-For': xff } })).text();
  try {
    // Railway only: Railway appends the visitor.
    assert.equal(await ip('41.66.200.7'), '41.66.200.7');
    // Cloudflare then Railway: visitor, then the Cloudflare edge.
    assert.equal(await ip('41.66.200.7, 162.158.10.20'), '41.66.200.7');
    // A forged header sent straight to Railway: the real sender is last and is not Cloudflare.
    assert.equal(await ip('9.9.9.9, 41.66.200.7'), '41.66.200.7');
    // Forged through Cloudflare: Cloudflare appends the real sender before its own edge.
    assert.equal(await ip('9.9.9.9, 41.66.200.7, 162.158.10.20'), '41.66.200.7');
  } finally {
    server.close();
  }
});
