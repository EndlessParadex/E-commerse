import { useEffect, useRef, useState } from 'react';
import { products } from '../../data/products';
import { rupiah } from './shopPresentation';

export function AdminCartAdd({ shared }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const categories = [
    ...new Set(products.map((product) => product.category).filter(Boolean)),
  ].sort();
  const search = query.trim().toLocaleLowerCase('id');
  const options = products
    .filter(
      (product) =>
        (!category || product.category === category) &&
        [product.baseName, product.name, product.brand, product.id, product.sizeLabel]
          .join(' ')
          .toLocaleLowerCase('id')
          .includes(search),
    )
    .slice(0, 50);
  const selected = options.find((product) => product.id === sku);
  const valid = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 99;

  return (
    <form
      className="shared-admin-add"
      aria-label="Tambah barang ke keranjang toko sebagai Admin"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!shared.canEdit || !selected || !valid) return;
        const saved = await shared.mutate('add', selected.id, Number(quantity));
        if (saved) setQuantity('1');
      }}
    >
      <div className="shared-admin-card-heading">
        <h3>Tambah barang</h3>
        <span className="shared-admin-hint">Tersimpan langsung di keranjang bersama</span>
      </div>
      <p>Pilih produk, tentukan kemasan dan jumlah, lalu tambahkan ke keranjang toko.</p>
      <div className="shared-admin-add-fields">
        <label htmlFor="shared-admin-search">
          Cari barang atau SKU
          <input
            id="shared-admin-search"
            type="search"
            maxLength={100}
            value={query}
            disabled={!shared.canEdit}
            onChange={(event) => {
              setQuery(event.target.value);
              setSku('');
            }}
            placeholder="Nama produk, merek, ukuran, atau SKU"
          />
        </label>
        <label htmlFor="shared-admin-category">
          Kategori
          <select
            id="shared-admin-category"
            value={category}
            disabled={!shared.canEdit}
            onChange={(event) => {
              setCategory(event.target.value);
              setSku('');
            }}
          >
            <option value="">Semua kategori</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="shared-admin-sku">
          Produk dan kemasan
          <select
            id="shared-admin-sku"
            value={sku}
            disabled={!shared.canEdit}
            onChange={(event) => setSku(event.target.value)}
            required
          >
            <option value="">Pilih SKU</option>
            {options.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.id}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="shared-admin-quantity">
          Jumlah kemasan
          <input
            id="shared-admin-quantity"
            type="number"
            min="1"
            max="99"
            step="1"
            inputMode="numeric"
            value={quantity}
            disabled={!shared.canEdit}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="shop-primary"
          disabled={!shared.canEdit || !selected || !valid}
        >
          + Tambah barang
        </button>
      </div>
      {selected && (
        <p>
          {selected.sizeLabel} · {selected.packagingType || 'satuan'} · {rupiah(selected.price)} per
          kemasan
        </p>
      )}
      {search && options.length === 50 && (
        <p>Hasil dibatasi 50 SKU. Persempit pencarian untuk memilih barang yang tepat.</p>
      )}
    </form>
  );
}

export function CartRemove({ item, shared }) {
  return (
    <button
      type="button"
      className="shared-quantity-remove"
      disabled={!shared.canEdit}
      aria-label={'Hapus ' + item.name + ' dari keranjang'}
      title="Hapus barang"
      onClick={() => void shared.mutate('remove', item.id)}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7" />
      </svg>
    </button>
  );
}

export function CartQuantity({ item, shared }) {
  const [draft, setDraft] = useState(null);
  const debounce = useRef(null);
  const value = draft?.value ?? String(item.quantity);
  const valid = /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99;
  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const save = async (candidate) => {
    window.clearTimeout(debounce.current);
    if (!shared.canEdit || !candidate) return;
    const next = Number(candidate.value);
    if (!/^\d+$/.test(candidate.value) || next < 1 || next > 99) return;
    if (next === item.quantity && candidate.revision === shared.cart.revision) {
      setDraft(null);
      return;
    }
    await shared.mutate('set', item.id, next, candidate.revision);
    setDraft((current) => (current === candidate ? null : current));
  };
  const step = (difference) => {
    if (!shared.canEdit || !valid) return;
    const next = Number(value) + difference;
    if (next < 1 || next > 99) return;
    void save({ value: String(next), revision: draft?.revision ?? shared.cart.revision });
  };
  return (
    <form
      className="shared-quantity"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft);
      }}
    >
      <div className="shared-quantity-label">
        <span className="shared-quantity-controls shared-admin-quantity-stepper">
          <button
            type="button"
            className="shared-quantity-step"
            aria-label={'Kurangi ' + item.name}
            disabled={!shared.canEdit || !valid || Number(value) <= 1}
            onClick={() => step(-1)}
          >
            −
          </button>
          <input
            id={'shared-quantity-' + item.id}
            type="number"
            min="1"
            max="99"
            step="1"
            inputMode="numeric"
            aria-label={'Jumlah ' + item.name}
            aria-invalid={!valid}
            value={value}
            disabled={!shared.canEdit}
            onChange={(event) => {
              const next = {
                value: event.target.value,
                revision: draft?.revision ?? shared.cart.revision,
              };
              window.clearTimeout(debounce.current);
              setDraft(next);
              if (
                /^\d+$/.test(next.value) &&
                Number(next.value) >= 1 &&
                Number(next.value) <= 99 &&
                Number(next.value) !== item.quantity
              ) {
                debounce.current = window.setTimeout(() => void save(next), 700);
              }
            }}
            onBlur={(event) => {
              if (event.relatedTarget?.closest('.shared-quantity-step')) return;
              if (draft) void save(draft);
            }}
          />
          <button
            type="button"
            className="shared-quantity-step"
            aria-label={'Tambah ' + item.name}
            disabled={!shared.canEdit || !valid || Number(value) >= 99}
            onClick={() => step(1)}
          >
            +
          </button>
        </span>
      </div>
      <button type="submit" className="shared-quantity-submit-sr">
        Simpan jumlah
      </button>
      {!valid && <small role="alert">Masukkan 1–99 kemasan.</small>}
      {draft && draft.revision !== shared.cart.revision && (
        <p role="status">Keranjang berubah saat Anda mengisi. Periksa isian terbaru.</p>
      )}
    </form>
  );
}

export function AdminCartQuantity({ item, shared }) {
  const [draft, setDraft] = useState(null);
  const value = draft?.value ?? String(item.quantity);
  const valid = /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 99;
  return (
    <form
      className="shared-quantity shared-admin-quantity-legacy"
      onSubmit={async (event) => {
        event.preventDefault();
        if (valid) {
          await shared.mutate('set', item.id, Number(value), draft?.revision);
          setDraft(null);
        }
      }}
    >
      <label>
        Jumlah kemasan
        <input
          type="number"
          min="1"
          max="99"
          step="1"
          inputMode="numeric"
          aria-label={'Jumlah ' + item.name}
          value={value}
          disabled={!shared.canEdit}
          onChange={(event) =>
            setDraft({
              value: event.target.value,
              revision: draft?.revision ?? shared.cart.revision,
            })
          }
        />
      </label>
      {['admin', 'owner'].includes(shared.role) && (
        <div
          className="shared-admin-quantity-stepper"
          role="group"
          aria-label={'Penyesuaian cepat ' + item.name}
        >
          <button
            type="button"
            aria-label={'Kurangi ' + item.name}
            disabled={!shared.canEdit || draft !== null || item.quantity <= 1}
            onClick={() => void shared.mutate('set', item.id, item.quantity - 1)}
          >
            −
          </button>
          <button
            type="button"
            aria-label={'Tambah ' + item.name}
            disabled={!shared.canEdit || draft !== null || item.quantity >= 99}
            onClick={() => void shared.mutate('set', item.id, item.quantity + 1)}
          >
            +
          </button>
        </div>
      )}
      <button
        className="bam-button-secondary"
        disabled={!shared.canEdit || !valid || Number(value) === item.quantity}
      >
        Simpan jumlah
      </button>
      <button
        type="button"
        className="bam-button-danger"
        disabled={!shared.canEdit}
        onClick={() => shared.mutate('remove', item.id)}
      >
        Hapus
      </button>
      {draft && draft.revision !== shared.cart.revision && (
        <p role="status">
          Keranjang berubah saat Anda mengisi. Periksa isian terbaru sebelum menyimpan.
        </p>
      )}
    </form>
  );
}
