import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateAdminList } from './adminPagination.js';

test('paginates catalog and stock rows without modifying their input', () => {
  const rows = Array.from({ length: 53 }, (_, index) => index);
  const first = paginateAdminList(rows, 1, 24);
  const middle = paginateAdminList(rows, 2, 24);
  const last = paginateAdminList(rows, 3, 24);
  assert.deepEqual([first.items.length, middle.items.length, last.items.length], [24, 24, 5]);
  assert.equal(middle.items[0], 24);
  assert.equal(last.items.at(-1), 52);
  assert.equal(first.total, 53);
  assert.equal(last.pages, 3);
  assert.equal(rows.length, 53);
});

test('empty, invalid and outdated page requests stay within valid bounds', () => {
  assert.deepEqual(paginateAdminList([], 9, 20), { items: [], total: 0, page: 1, pages: 1 });
  assert.equal(paginateAdminList([1, 2, 3], -10, 2).page, 1);
  assert.equal(paginateAdminList([1, 2, 3], 999, 2).page, 2);
  assert.equal(paginateAdminList([1, 2, 3], NaN, 2).page, 1);
  assert.throws(() => paginateAdminList([1], 1, 0), RangeError);
});
