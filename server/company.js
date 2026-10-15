import { randomUUID } from 'node:crypto';
import { CatalogError, photo } from './catalog.js';
import {
  demoCompanyProfile,
  emptyCompanyProfile,
  companyProfileErrors,
  normalizedCompanyProfile,
} from '../src/data/companyProfile.js';

export class CompanyRepository {
  constructor(db, requestedMode = 'demo') {
    if (!['demo', 'company'].includes(requestedMode))
      throw new Error('BAM_INSTALL_MODE harus demo atau company.');
    this.db = db;
    // An installation predating company settings retains its catalog and BAM identity.
    const legacy =
      db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='catalog_meta'")
        .get() && db.prepare('SELECT id FROM catalog_meta WHERE id=1').get();
    db.exec(
      "CREATE TABLE IF NOT EXISTS company_settings (id INTEGER PRIMARY KEY CHECK(id=1), instance_id TEXT NOT NULL UNIQUE, mode TEXT NOT NULL CHECK(mode IN ('demo','company')), revision INTEGER NOT NULL, profile TEXT NOT NULL)",
    );
    if (!db.prepare('SELECT id FROM company_settings WHERE id=1').get()) {
      const mode = legacy ? 'demo' : requestedMode;
      db.prepare('INSERT INTO company_settings VALUES(1,?,?,0,?)').run(
        randomUUID(),
        mode,
        JSON.stringify(mode === 'company' ? emptyCompanyProfile : demoCompanyProfile),
      );
    }
  }
  snapshot() {
    const row = this.db.prepare('SELECT * FROM company_settings WHERE id=1').get();
    return {
      version: 1,
      instanceId: row.instance_id,
      mode: row.mode,
      revision: row.revision,
      profile: {
        bankName: '',
        bankAccount: '',
        bankHolder: '',
        bankInstructions: '',
        codEnabled: true,
        showSoldCount: false,
        showExactStock: true,
        ...JSON.parse(row.profile),
      },
    };
  }
  save(body) {
    const errors = companyProfileErrors(body?.profile);
    if (Object.keys(errors).length)
      throw new CatalogError('Periksa nama, kontak, dan logo perusahaan.');
    const current = this.snapshot().profile;
    const profile = normalizedCompanyProfile({
      ...current,
      ...body.profile,
      showSoldCount: body.profile.showSoldCount ?? current.showSoldCount,
      showExactStock: body.profile.showExactStock ?? current.showExactStock,
    });
    profile.logo = photo(profile.logo);
    if (body?.version !== 1 || !Number.isSafeInteger(body.revision) || body.revision < 0)
      throw new CatalogError('Format pengaturan perusahaan tidak valid.');
    // UPDATE with a revision predicate is atomic, including between two server processes.
    const result = this.db
      .prepare(
        'UPDATE company_settings SET profile=?,revision=revision+1 WHERE id=1 AND revision=?',
      )
      .run(JSON.stringify(profile), body.revision);
    if (!result.changes)
      throw new CatalogError(
        'Pengaturan telah diubah oleh admin lain. Muat pengaturan terbaru sebelum menyimpan kembali.',
        409,
        'revision_conflict',
      );
    return this.snapshot();
  }
}
