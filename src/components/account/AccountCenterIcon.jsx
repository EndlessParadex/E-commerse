const icons = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  address: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  orders: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M9 11h6M9 15h6M9 7h3" />
    </>
  ),
  favorite: (
    <path d="M20.8 5.7a5.6 5.6 0 0 0-7.9 0L12 6.6l-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.9a5.6 5.6 0 0 0 0-7.9Z" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18M8 14h3M14 14h3M8 18h3" />
    </>
  ),
  appearance: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18h2.5a2 2 0 0 0 1.4-3.4 2 2 0 0 1 1.4-3.4h1.2A3.5 3.5 0 0 0 22 10.8 9.5 9.5 0 0 0 12 3Z" />
      <circle cx="7.5" cy="12" r="1" />
      <circle cx="11" cy="7.5" r="1" />
      <circle cx="16" cy="9.5" r="1" />
    </>
  ),
  admin: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="m3 7 9 7 9-7" />
    </>
  ),
  logout: (
    <>
      <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  camera: (
    <>
      <path d="M5 7h3l2-2h4l2 2h3a2 2 0 0 1 2 2v10H3V9a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l12-12-4-4L4 16v4ZM14 6l4 4" />
    </>
  ),
};
export default function AccountCenterIcon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={'account-center-icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name] || icons.user}
    </svg>
  );
}
