const paths = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  home: 'M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3V10.5Z',
  bolt: 'm13 2-9 11h7l-1 9 10-12h-7l0-8Z',
  calendar: 'M4 6h16v15H4V6ZM8 3v6M16 3v6M4 11h16M8 15h3M14 15h2',
  cart: 'M2 4h3l2.8 12.5h11.5L22 7H6M9 21h.01M19 21h.01',
  products: 'M4 7h16v14H4zM3 3h18v4H3zM9 11h6',
  orders: 'M7 5H5v16h14V5h-2M9 3h6v4H9zM8 12h8M8 16h5',
  stock: 'm3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10M7 5l9 4',
  suppliers: 'M3 21V7l9-4v18M12 9h9v12M6 9h2M6 13h2M6 17h2M15 13h3M15 17h3M1 21h22',
  brands: 'M3 3h8l10 10-8 8L3 11ZM7 7h.01',
  categories: 'M4 5h3v3H4zM11 6h9M4 11h3v3H4zM11 12h9M4 17h3v3H4zM11 18h9',
  company: 'M4 21V4h12v17M16 10h4v11M8 8h4M8 12h4M8 16h4M2 21h20',
  store: 'M3 10h18l-2-7H5l-2 7ZM4 10v11h16V10M9 21v-7h6v7',
  account: 'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
};

export default function NavigationIcon({ name }) {
  return (
    <svg
      className="navigation-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] || paths.overview} />
    </svg>
  );
}
