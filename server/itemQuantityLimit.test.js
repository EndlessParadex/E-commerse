import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './app.js';

test('an older database keeps its store cart items and accepts up to 999 packages per SKU', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bam-item-limit-'));
  const dbPath = join(dir, 'old.sqlite');
  const old = new DatabaseSync(dbPath);
  old.exec(`CREATE TABLE cart_cycles (
      id TEXT PRIMARY KEY, store_id TEXT NOT NULL, delivery_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', revision INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(store_id,delivery_date));
    CREATE TABLE cart_items (
      cart_id TEXT NOT NULL REFERENCES cart_cycles(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
      snapshot TEXT NOT NULL, PRIMARY KEY(cart_id,product_id));
    INSERT INTO cart_cycles VALUES('cart-1','store-1','2026-11-10','open',0,1,1);
    INSERT INTO cart_items VALUES('cart-1','SKU-1',42,'{}');`);
  old.close();
  const app = createApp({ dbPath, logger: () => {} });
  try {
    const { sql } = app.db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='cart_items'")
      .get();
    assert.match(sql, /BETWEEN 1 AND 999/);
    assert.deepEqual(
      { ...app.db.prepare('SELECT product_id,quantity FROM cart_items').get() },
      { product_id: 'SKU-1', quantity: 42 },
    );
    app.db.prepare("UPDATE cart_items SET quantity=999 WHERE product_id='SKU-1'").run();
    assert.throws(() =>
      app.db.prepare("UPDATE cart_items SET quantity=1000 WHERE product_id='SKU-1'").run(),
    );
  } finally {
    app.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
