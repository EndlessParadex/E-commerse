import { Component } from 'react';
export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="shop-page" role="alert">
          <h1>Halaman belum dapat ditampilkan</h1>
          <p>
            Terjadi kendala pada tampilan. Data yang tersimpan di server tetap tersedia. Muat ulang
            halaman untuk mencoba kembali.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Muat ulang halaman
          </button>
          <p>
            <a href="/#/">Kembali ke beranda</a>
          </p>
        </main>
      );
    return this.props.children;
  }
}
