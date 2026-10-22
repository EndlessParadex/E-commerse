import { stockEditorTypes } from '../../data/stockEditorModel';

export default function StockPackageEditor({
  target, busy, stockFailed, mode, quantities, factors, preview, error,
  onModeChange, onQuantityChange, onSave, onCancel, onReload, server, inputRef,
}) {
  const number = (value) => value.toLocaleString('id-ID');
  return (
    <form className="workflow-stock-editor workflow-stock-package-editor"
      aria-label={'Ubah stok ' + target.product.baseName + ' ' + target.product.sizeLabel}
      aria-busy={busy} noValidate onSubmit={onSave}>
      <fieldset className="workflow-stock-editor-mode" disabled={busy}>
        <legend>Jenis perubahan stok</legend>
        <label>
          <input type="radio" name="stock-mode" value="replace"
            checked={mode === 'replace'} onChange={() => onModeChange('replace')} />
          <span>Tetapkan stok baru</span>
        </label>
        <label>
          <input type="radio" name="stock-mode" value="add"
            checked={mode === 'add'} onChange={() => onModeChange('add')} />
          <span>Tambah stok masuk</span>
        </label>
      </fieldset>
      <div className="workflow-stock-quantity-heading">
        <strong>Jumlah berdasarkan kemasan</strong>
        <small>Isi kemasan mengikuti katalog produk, bukan angka perkiraan.</small>
      </div>
      <div className="workflow-stock-quantity-grid">
        {stockEditorTypes.map(({ id, label }) => (
          <div className="workflow-stock-quantity" key={id}>
            <label htmlFor={'stock-' + id}>{label}</label>
            <input id={'stock-' + id}
              ref={id === 'satuan' ? inputRef : undefined}
              type="number" inputMode="numeric" min="0" max="1000000000" step="1"
              value={quantities[id]} disabled={busy || !factors[id]}
              aria-invalid={Boolean(error && preview?.error)}
              aria-describedby={'stock-help-' + id}
              onChange={(event) => onQuantityChange(id, event.target.value)}
            />
            <small id={'stock-help-' + id}>
              {factors[id]
                ? '1 ' + label.toLowerCase() + ' = ' + number(factors[id]) + ' satuan'
                : id === 'karton'
                  ? 'Jenis karton belum tersedia di katalog'
                  : 'Kemasan belum diatur untuk ukuran ini'}
            </small>
          </div>
        ))}
      </div>
      <p className="workflow-stock-editor-explanation">
        Jumlah dus, pack, dan satuan diisi terpisah. Isi pack di dalam dus tidak dihitung dua kali.
      </p>
      <div className="workflow-stock-calc" aria-live="polite">
        <div className="workflow-stock-calc-rows">
          {stockEditorTypes.filter(({ id }) => factors[id]).map(({ id, label }) => {
            const count = Number(quantities[id]);
            const contribution = count * factors[id];
            return (
              <div key={id}>
                <span>{quantities[id] || '0'} {label.toLowerCase()} × {number(factors[id])}</span>
                <span>
                  {/^\d+$/.test(quantities[id]) && Number.isSafeInteger(contribution)
                    ? number(contribution) + ' satuan' : 'Periksa jumlah'}
                </span>
              </div>
            );
          })}
        </div>
        {mode === 'add' && <p>Stok sebelumnya: {number(target.available)} satuan</p>}
        <div className="workflow-stock-calc-total">
          <strong>{mode === 'add' ? 'Stok setelah penambahan' : 'Total stok baru'}</strong>
          <output id="stock-total-preview" htmlFor={stockEditorTypes.map(({ id }) => 'stock-' + id).join(' ')}>
            {preview?.error ? '—' : number(preview.finalStock)} satuan
          </output>
        </div>
      </div>
      <p id="stock-edit-help" className="workflow-stock-editor-note">
        {mode === 'add'
          ? 'Stok masuk ditambahkan ke stok saat ini. Jika stok di perangkat lain berubah, muat angka terbaru sebelum menyimpan.'
          : 'Jumlah ini menggantikan stok tersedia saat ini. Stok pesanan yang sudah dibuat tetap dipertahankan.'}
      </p>
      {error && <p id="stock-edit-error" className="workflow-error" role="alert">{error}</p>}
      <div className="workflow-stock-edit-actions">
        <button type="submit" className="admin-primary" disabled={busy || stockFailed}>
          {busy ? 'Menyimpan…' : 'Simpan stok'}
        </button>
        <button type="button" className="admin-secondary" disabled={busy} onClick={onCancel}>Batal</button>
      </div>
      {server && error && (
        <button type="button" className="admin-text-button" disabled={busy} onClick={onReload}>
          Muat stok terbaru ke form
        </button>
      )}
    </form>
  );
}
