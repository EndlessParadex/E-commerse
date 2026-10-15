const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  orders: 'M7 3h10v4H7z M7 5H5v16h14V5h-2 M8 12h8 M8 16h6',
  stock: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7.5 5l9 4',
  products: 'M4 4h16v16H4z M4 9h16 M9 9v11 M15 13h2 M15 16h2',
  suppliers: 'M3 4h11v17H3z M14 10h7v11h-7 M7 8h3 M7 12h3 M7 16h3 M17 14h1 M17 17h1',
  brands: 'M3 3h7l11 11-7 7L3 10z M7 7h.01',
  categories: 'M9 5h12 M9 12h12 M9 19h12 M3 5h.01 M3 12h.01 M3 19h.01',
  company: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  accounts:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
  email: 'M3 5h18v14H3z M3 5l9 7 9-7',
  store: 'M14 3h7v7 M21 3 11 13 M10 3H3v18h18v-7',
};

export default function AdminIcon({ name }) {
  return (
    <svg
      className="admin-icon"
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
