import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { randomUUID } from 'node:crypto';
import { seedSharedCart } from './sharedCartFixture.js';

test('B2B store: only BAM owner creates and assigns, buyers and sales see scoped stores', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { db } = app;
    for (const [id, role] of [['owner-b2b','admin'],['operator-b2b','admin'],['buyer-b2b','user'],['sales-b2b','user'],['other-b2b','user']]) {
      db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)')
        .run(id,id,id + '@fixture.test','Alamat pengujian B2B','fixture','2026-10-17',role);
      db.prepare('INSERT INTO auth_account_state(user_id,verified_at,credential_revision) VALUES(?,?,0)')
        .run(id,Date.now());
    }
    db.prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)').run('owner-b2b','2026-10-17');
    const owner={id:'owner-b2b',role:'admin'}, operator={id:'operator-b2b',role:'admin'};
    const buyer={id:'buyer-b2b',role:'user'}, sales={id:'sales-b2b',role:'user'}, other={id:'other-b2b',role:'user'};
    const store=app.b2bStores.create(owner,{storeName:'Toko Nusantara',phone:'081234567890',address:'Jalan Nusantara Nomor 15'});
    assert.match(store.storeCode,/^TKB-\d{6}$/);
    assert.equal(store.phone,'+6281234567890');
    assert.throws(()=>app.b2bStores.create(operator,{storeName:'Toko Lain',phone:'081234567890',address:'Jalan Nusantara Nomor 15'}),{code:'forbidden'});
    assert.deepEqual(app.b2bStores.list(buyer),[]);
    assert.throws(()=>app.b2bStores.addMember(other,store.id,buyer.id),{code:'forbidden'});
    assert.deepEqual(app.b2bStores.addMember(owner,store.id,buyer.id).linked,true);
    assert.equal(app.b2bStores.list(buyer).length,1);
    assert.deepEqual(app.b2bStores.list(other),[]);
    assert.throws(()=>app.b2bStores.assignSales(owner,store.id,sales.id),{code:'sales_required'});
    app.b2bStores.appointSales(owner,sales.id);
    app.b2bStores.assignSales(owner,store.id,sales.id);
    assert.equal(app.b2bStores.list(sales).length,1);
    assert.equal(app.b2bStores.role(sales),'sales');
    assert.throws(()=>app.b2bStores.addMember(owner,store.id,sales.id),{code:'invalid_buyer_account'});
    assert.equal(app.b2bStores.salesList(operator)[0].assignedStores,1);
    assert.ok(db.prepare('SELECT COUNT(*) n FROM b2b_store_audit').get().n>=4);
  } finally { app.db.close(); }
});


test('B2B delivery schedule is assigned once by Owner and server rejects off-calendar new carts', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { first, actors } = seedSharedCart(app);
    const schedule = { weekday: 1, intervalWeeks: 2, anchorDate: '2026-10-26' };
    const version = app.b2bStores.store(first.id).revision;
    assert.throws(
      () => app.b2bStores.setSchedule(actors.operator, first.id, { ...schedule, revision: version }),
      { code: 'forbidden' },
    );
    assert.throws(
      () => app.b2bStores.setSchedule(actors.owner, first.id,
        { ...schedule, weekday: 3, revision: version }),
      { code: 'validation_error' },
    );
    const saved = app.b2bStores.setSchedule(actors.owner, first.id, { ...schedule, revision: version });
    assert.deepEqual(saved.deliverySchedule, schedule);
    assert.equal(app.b2bStores.deliveryDate(first.id, '2026-10-21'), '2026-10-26');
    assert.equal(app.b2bStores.deliveryDate(first.id, '2026-10-27'), '2026-11-09');
    assert.equal(app.b2bStores.deliveryDate(first.id, '2026-11-09'), '2026-11-09');
    assert.throws(
      () => app.b2bStores.setSchedule(actors.owner, first.id,
        { ...schedule, revision: saved.revision }),
      { code: 'schedule_locked' },
    );
    const mutate = (date) => app.sharedCarts.mutate(actors.buyer, first.id, {
      date, revision: 0, requestId: randomUUID(), action: 'add',
      productId: 'snack-pedas-23g', quantity: 2,
    });
    assert.throws(() => mutate('2026-10-27'), { code: 'invalid_delivery_schedule' });
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cart_cycles WHERE store_id=?')
      .get(first.id).n, 0);
    const valid = mutate('2026-10-26');
    assert.equal(valid.date, '2026-10-26');
    assert.equal(valid.items[0].quantity, 2);
  } finally {
    app.db.close();
  }
});


test('B2B store owner: create, transfer and preserve legacy stores without guessing ownership', () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { db, b2bStores: stores } = app;
    const actors = [
      ['manager', 'admin'], ['buyer-one', 'user'],
      ['buyer-two', 'user'], ['buyer-three', 'user'],
      ['buyer-four', 'user'], ['sales-only', 'user'],
    ];
    for (const [id, role] of actors) {
      db.prepare('INSERT INTO users(id,name,email,address,password_hash,created_at,role) VALUES(?,?,?,?,?,?,?)')
        .run(id, id, id+'@fixture.test', 'Jalan Test 1234', 'fixture', '2026-10-23', role);
    }
    db.prepare('INSERT INTO store_owners(user_id,granted_at) VALUES(?,?)')
      .run('manager', '2026-10-23');
    const manager = { id: 'manager', role: 'admin' };
    const form = { storeName: 'Toko Test Satu', phone: '081234567890', address: 'Jalan Simulasi 100' };
    const legacy = stores.create(manager, form);
    stores.addMember(manager, legacy.id, 'buyer-one');
    assert.equal(stores.store(legacy.id).owner, null, 'do not infer legacy owner from members');
    assert.throws(() => stores.create(manager, { ...form, ownerUserId: 'buyer-one' }),
      {code:'buyer_already_linked'});
    const owned = stores.create(manager, { ...form, ownerUserId: 'buyer-three' });
    assert.equal(owned.owner.id, 'buyer-three');
    assert.equal(stores.list({id:'buyer-one',role:'user'}).length, 1);
    assert.equal(stores.details(manager, owned.id).members[0].isStoreOwner, true);
    const rev = stores.store(owned.id).revision;
    assert.throws(() => stores.removeLink(manager, owned.id, 'members',
      {userId:'buyer-three', revision:rev}), {code:'store_owner_required'});
    assert.throws(() => stores.setOwner({id:'buyer-one',role:'user'}, owned.id,
      {userId:'buyer-two',revision:rev}), {code:'forbidden'});
    stores.appointSales(manager, 'sales-only');
    assert.throws(() => stores.setOwner(manager, owned.id,
      {userId:'sales-only',revision:rev}), {code:'invalid_buyer_account'});
    assert.equal(stores.store(owned.id).owner.id, 'buyer-three');
    assert.throws(() => stores.setOwner(manager, owned.id,
      {userId:'buyer-two',revision:rev-1}), {code:'revision_conflict'});
    assert.equal(stores.store(owned.id).revision, rev);
    const transferred = stores.setOwner(manager, owned.id,
      {userId:'buyer-two', revision:rev});
    assert.equal(transferred.owner.id, 'buyer-two');
    assert.equal(transferred.revision, rev+1);
    assert.equal(stores.details(manager, owned.id).members.length, 1);
    assert.deepEqual(stores.list({id:'buyer-one',role:'user'}).map(x=>x.id), [legacy.id]);
    assert.deepEqual(stores.list({id:'buyer-three',role:'user'}).map(x=>x.id), []);
    assert.deepEqual(stores.list({id:'buyer-two',role:'user'}).map(x=>x.id), [owned.id]);
    const last = stores.setOwner(manager, legacy.id,
      {userId:'buyer-four',revision:stores.store(legacy.id).revision,keepPreviousMember:true});
    assert.equal(last.owner.id,'buyer-four');
    assert.throws(() => stores.setOwner(manager, legacy.id,
      {userId:'buyer-two',revision:last.revision}), {code:'buyer_already_linked'});
    const available = stores.candidates(manager,new URLSearchParams({purpose:'owner'}));
    assert.deepEqual(available.users.map(x=>x.id), ['buyer-three']);
    const memberCandidates = stores.candidates(manager,new URLSearchParams({purpose:'member'}));
    assert.ok(memberCandidates.users.some(x=>x.id==='buyer-one'));
    assert.ok(memberCandidates.users.some(x=>x.id==='buyer-two'));
    const actions = db.prepare('SELECT action FROM b2b_store_audit WHERE store_id=?').all(owned.id);
    assert.ok(actions.some(x=>x.action==='store_owner_transferred'));
  } finally { app.db.close(); }
});


test('promoting a buyer to Sales revokes buyer access and requires explicit Sales assignment', async () => {
  const app = createApp({ dbPath: ':memory:', logger: () => {} });
  try {
    const { actors, first, second } = seedSharedCart(app);
    // A formerly linked buyer may belong to multiple stores; neither grants Sales access.
    app.b2bStores.addMember(actors.owner, second.id, 'buyer2');
    const firstRevision = app.b2bStores.store(first.id).revision;
    const secondRevision = app.b2bStores.store(second.id).revision;
    assert.deepEqual(
      app.b2bStores.list(actors.buyer2).map((store) => store.id).sort(),
      [first.id, second.id].sort(),
    );
    const promoted = app.b2bStores.appointSales(actors.owner, 'buyer2');
    assert.equal(promoted.buyerLinksRemoved, 2);
    assert.equal(app.b2bStores.role(actors.buyer2), 'sales');
    assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM b2b_store_members WHERE user_id=?')
      .get('buyer2').n, 0);
    assert.equal(app.b2bStores.store(first.id).revision, firstRevision + 1);
    assert.equal(app.b2bStores.store(second.id).revision, secondRevision + 1);
    assert.equal(app.db.prepare(
      "SELECT COUNT(*) AS n FROM b2b_store_audit WHERE target_user_id=? AND action='buyer_unlinked'",
    ).get('buyer2').n, 2);
    assert.equal(app.b2bStores.page(actors.buyer2, new URLSearchParams()).total, 0);
    assert.deepEqual(app.b2bStores.list(actors.buyer2), []);
    assert.throws(() => app.sharedCarts.read(actors.buyer2, first.id, '2026-10-21'),
      { code: 'store_not_found' });
    // Legacy mixed links must never bypass a missing Sales assignment either.
    app.db.prepare('INSERT INTO b2b_store_members VALUES(?,?,?,?)')
      .run(second.id, 'buyer2', actors.owner.id, Date.now());
    assert.equal(app.b2bStores.page(actors.buyer2, new URLSearchParams()).total, 0);
    assert.deepEqual(app.b2bStores.list(actors.buyer2), []);
    assert.throws(() => app.sharedCarts.read(actors.buyer2, second.id, '2026-10-21'),
      { code: 'store_not_found' });
    const assigned = app.b2bStores.assignSales(actors.owner, first.id, 'buyer2');
    assert.equal(assigned.assigned, true);
    assert.deepEqual(app.b2bStores.list(actors.buyer2).map((store) => store.id), [first.id]);
    assert.equal(app.b2bStores.page(actors.buyer2, new URLSearchParams()).total, 1);
    assert.equal(app.sharedCarts.read(actors.buyer2, first.id, '2026-10-21').date, '2026-10-21');
    assert.throws(() => app.sharedCarts.read(actors.buyer2, second.id, '2026-10-21'),
      { code: 'store_not_found' });
    assert.equal(app.b2bStores.appointSales(actors.owner, 'buyer2').buyerLinksRemoved, 1);
    assert.equal(app.b2bStores.list(actors.buyer2).length, 1,
      'reappointment does not revoke a valid Sales assignment');
  } finally {
    app.db.close();
  }
});
