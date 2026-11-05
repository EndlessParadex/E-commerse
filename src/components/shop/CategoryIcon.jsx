/**
 * Line icons for catalog categories, matching the navigation icons.
 * Categories are entered by Admin, so the icon is picked from the category
 * name; unknown names get a neutral grid icon instead of an emoji.
 */
const ICONS = {
  food: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  beauty: (
    <>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" />
    </>
  ),
  spice: (
    <>
      <path d="M4 11h16" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M9 7c0-1 1-1.5 1-2.5M13 7c0-1 1-1.5 1-2.5" />
    </>
  ),
  home: (
    <>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  drink: (
    <>
      <path d="M7 4h10l-1.5 16h-7z" />
      <path d="M7.5 9h9" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
};

const RULES = [
  ['beauty', /kosmetik|beauty|kecantikan|perawatan|skincare|parfum/i],
  ['spice', /bumbu|masak|dapur|rempah|saus/i],
  ['drink', /minum|drink|kopi|teh|susu|jus/i],
  ['home', /rumah|home|kebersihan|rumah tangga|sabun|deterjen/i],
  ['food', /snack|makan|camilan|kue|roti|food|sembako|beras/i],
];

function categoryIconName(category) {
  const text = [category?.id, category?.name].filter(Boolean).join(' ');
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] || 'grid';
}

export default function CategoryIcon({ category, className = '' }) {
  return (
    <svg
      className={'bam-category-icon ' + className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
    >
      {ICONS[categoryIconName(category)]}
    </svg>
  );
}
