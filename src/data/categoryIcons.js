export const categoryIconGroups = [
  {
    name: 'Umum',
    icons: [
      ['📦', 'Barang umum'],
      ['🛒', 'Belanja'],
      ['🛍️', 'Ritel'],
      ['🏪', 'Toko'],
    ],
  },
  {
    name: 'Snack dan permen',
    icons: [
      ['🍫', 'Cokelat'],
      ['🍪', 'Biskuit dan cookies'],
      ['🍿', 'Popcorn'],
      ['🥔', 'Snack kentang'],
      ['🥜', 'Kacang'],
      ['🍘', 'Kerupuk'],
      ['🥨', 'Camilan asin'],
      ['🍬', 'Permen'],
      ['🍭', 'Lolipop'],
      ['🍩', 'Donat'],
    ],
  },
  {
    name: 'Makanan dan sembako',
    icons: [
      ['🍛', 'Nasi dan kari'],
      ['🍚', 'Beras dan nasi'],
      ['🍜', 'Mi'],
      ['🍝', 'Pasta'],
      ['🍞', 'Roti'],
      ['🥐', 'Pastri'],
      ['🥣', 'Sereal'],
      ['🥚', 'Telur'],
      ['🧀', 'Keju'],
      ['🥫', 'Makanan kaleng'],
      ['🍯', 'Madu'],
      ['🍱', 'Makanan siap saji'],
    ],
  },
  {
    name: 'Minuman',
    icons: [
      ['🥤', 'Minuman ringan'],
      ['🧃', 'Jus kotak'],
      ['🧋', 'Teh susu'],
      ['🥛', 'Susu'],
      ['☕', 'Kopi'],
      ['🍵', 'Teh'],
      ['🧊', 'Es'],
      ['💧', 'Air minum'],
    ],
  },
  {
    name: 'Bumbu dan bahan masakan',
    icons: [
      ['🧂', 'Garam'],
      ['🌶️', 'Cabai dan saus pedas'],
      ['🧄', 'Bawang putih'],
      ['🧅', 'Bawang merah'],
      ['🫚', 'Jahe'],
      ['🥥', 'Kelapa dan santan'],
      ['🫘', 'Kacang biji'],
      ['🫙', 'Bumbu dan selai'],
    ],
  },
  {
    name: 'Buah dan bahan segar',
    icons: [
      ['🍎', 'Apel'],
      ['🍌', 'Pisang'],
      ['🍊', 'Jeruk'],
      ['🍋', 'Lemon'],
      ['🥭', 'Mangga'],
      ['🥬', 'Sayuran'],
      ['🐟', 'Ikan'],
      ['🍗', 'Ayam'],
    ],
  },
  {
    name: 'Kebersihan dan perawatan',
    icons: [
      ['🧼', 'Sabun'],
      ['🧽', 'Spons'],
      ['🧹', 'Alat pembersih'],
      ['🪣', 'Ember'],
      ['🧻', 'Tisu'],
      ['🪥', 'Sikat gigi'],
      ['🧴', 'Perawatan tubuh'],
      ['✨', 'Kecantikan'],
    ],
  },
  {
    name: 'Perlengkapan lainnya',
    icons: [
      ['💻', 'Komputer'],
      ['📱', 'Ponsel'],
      ['🔋', 'Baterai'],
      ['💡', 'Lampu'],
      ['👕', 'Pakaian'],
      ['👟', 'Sepatu'],
      ['🍼', 'Perlengkapan bayi'],
      ['🧸', 'Mainan'],
    ],
  },
];

const allowedIcons = new Set(
  categoryIconGroups.flatMap((group) => group.icons.map(([icon]) => icon)),
);
export const isCategoryIcon = (value) => allowedIcons.has(value);
