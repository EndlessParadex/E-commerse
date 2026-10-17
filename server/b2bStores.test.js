import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

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
    db.prepare('INSERT INTO store_owners(user_id,created_at) VALUES(?,?)').run('owner-b2b','2026-10-17');
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
