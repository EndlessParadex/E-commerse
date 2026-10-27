const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  orders: 'M7 3h10v4H7z M7 5H5v16h14V5h-2 M8 12h8 M8 16h6',
  stock: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7.5 5l9 4',
  products: 'M4 4h16v16H4z M4 9h16 M9 9v11 M15 13h2 M15 16h2',
  suppliers: 'M3 4h11v17H3z M14 10h7v11h-7 M7 8h3 M7 12h3 M7 16h3 M17 14h1 M17 17h1',
  brands: 'M3 3h7l11 11-7 7L3 10z M7 7h.01',
  categories: 'M9 5h12 M9 12h12 M9 19h12 M3 5h.01 M3 12h.01 M3 19h.01',
  company: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  b2bStores: 'M3 10h18 M4 10v11h16V10 M3 10l2-7h14l2 7 M9 21v-7h6v7 M8 3v7 M16 3v7',
  accounts:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87',
  email: 'M3 5h18v14H3z M3 5l9 7 9-7',
  store: 'M14 3h7v7 M21 3 11 13 M10 3H3v18h18v-7',
  calendar: 'M8 2v4 M16 2v4 M3 10h18 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 14h3 M8 17h3',
  owner: 'M20 21v-2a6 6 0 0 0-6-6H10a6 6 0 0 0-6 6v2 M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  sales: 'M3 7h18v13H3z M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M3 13h18 M10 13v2h4v-2',
  details: 'M3 3h18v18H3z M3 9h18 M9 9v12 M14 13h4 M14 17h4',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 11v6 M12 7h.01',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16 M17 17l5 5',
  plus: 'M12 5v14 M5 12h14',

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
