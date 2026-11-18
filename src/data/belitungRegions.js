// Pulau Belitung: Kabupaten Belitung (19.02) and Kabupaten Belitung Timur (19.06).
// Source: Kode wilayah Kemendagri, Kepmendagri No. 300.2.2-2138 Tahun 2025
// (machine-readable copy: github.com/cahyadsn/wilayah, db/wilayah.sql). Official spelling kept,
// e.g. "Tanjungpandan". Codes ending 1xxx are kelurahan; 2xxx are desa.
export const PROVINCE = 'Kepulauan Bangka Belitung';
export const REGENCIES = Object.freeze({
  19.02: 'Kabupaten Belitung',
  19.06: 'Kabupaten Belitung Timur',
});
export const DISTRICTS = Object.freeze([
  { code: '19.02.01', name: 'Tanjungpandan' },
  { code: '19.02.02', name: 'Membalong' },
  { code: '19.02.03', name: 'Selat Nasik' },
  { code: '19.02.04', name: 'Sijuk' },
  { code: '19.02.05', name: 'Badau' },
  { code: '19.06.01', name: 'Manggar' },
  { code: '19.06.02', name: 'Gantung' },
  { code: '19.06.03', name: 'Dendang' },
  { code: '19.06.04', name: 'Kelapa Kampit' },
  { code: '19.06.05', name: 'Damar' },
  { code: '19.06.06', name: 'Simpang Renggiang' },
  { code: '19.06.07', name: 'Simpang Pesak' },
]);
export const VILLAGES = Object.freeze([
  { code: '19.02.01.1001', name: 'Kota' },
  { code: '19.02.01.1002', name: 'Parit' },
  { code: '19.02.01.1005', name: 'Lesung Batang' },
  { code: '19.02.01.1006', name: 'Pangkallalang' },
  { code: '19.02.01.1009', name: 'Tanjungpendam' },
  { code: '19.02.01.1011', name: 'Paal Satu' },
  { code: '19.02.01.1016', name: 'Kampong Damai' },
  { code: '19.02.01.2003', name: 'Buluh Tumbang' },
  { code: '19.02.01.2004', name: 'Perawas' },
  { code: '19.02.01.2007', name: 'Dukong' },
  { code: '19.02.01.2008', name: 'Juru Seberang' },
  { code: '19.02.01.2010', name: 'Air Saga' },
  { code: '19.02.01.2012', name: 'Air Merbau' },
  { code: '19.02.01.2013', name: 'Aik Pelempang Jaya' },
  { code: '19.02.01.2014', name: 'Aik Ketekok' },
  { code: '19.02.01.2015', name: 'Aik Rayak' },
  { code: '19.02.02.2001', name: 'Membalong' },
  { code: '19.02.02.2002', name: 'Perpat' },
  { code: '19.02.02.2003', name: 'Lassar' },
  { code: '19.02.02.2004', name: 'Simpang Rusa' },
  { code: '19.02.02.2005', name: 'Kembiri' },
  { code: '19.02.02.2006', name: 'Bantan' },
  { code: '19.02.02.2007', name: 'Tanjungrusa' },
  { code: '19.02.02.2008', name: 'Mentigi' },
  { code: '19.02.02.2009', name: 'Pulau Seliu' },
  { code: '19.02.02.2010', name: 'Pulau Sumedang' },
  { code: '19.02.02.2011', name: 'Gunung Riting' },
  { code: '19.02.02.2012', name: 'Padang Kandis' },
  { code: '19.02.03.2001', name: 'Selat Nasik' },
  { code: '19.02.03.2002', name: 'Petaling' },
  { code: '19.02.03.2003', name: 'Suak Gual' },
  { code: '19.02.03.2004', name: 'Pulau Gersik' },
  { code: '19.02.04.2001', name: 'Sijuk' },
  { code: '19.02.04.2002', name: 'Batu Itam' },
  { code: '19.02.04.2003', name: 'Terong' },
  { code: '19.02.04.2004', name: 'Air Seruk' },
  { code: '19.02.04.2005', name: 'Tanjung Binga' },
  { code: '19.02.04.2006', name: 'Air Selumar' },
  { code: '19.02.04.2007', name: 'Sungai Padang' },
  { code: '19.02.04.2008', name: 'Keciput' },
  { code: '19.02.04.2009', name: 'Pelepak Pute' },
  { code: '19.02.04.2010', name: 'Tanjong Tinggi' },
  { code: '19.02.05.2001', name: 'Badau' },
  { code: '19.02.05.2002', name: 'Air Batu Buding' },
  { code: '19.02.05.2003', name: 'Sungai Samak' },
  { code: '19.02.05.2004', name: 'Kacang Butor' },
  { code: '19.02.05.2005', name: 'Cerucuk' },
  { code: '19.02.05.2006', name: 'Pegantungan' },
  { code: '19.02.05.2007', name: 'Ibul' },
  { code: '19.06.01.2001', name: 'Lalang Jaya' },
  { code: '19.06.01.2002', name: 'Kurnia Jaya' },
  { code: '19.06.01.2003', name: 'Padang' },
  { code: '19.06.01.2004', name: 'Kelubi' },
  { code: '19.06.01.2006', name: 'Lalang' },
  { code: '19.06.01.2007', name: 'Baru' },
  { code: '19.06.01.2010', name: 'Buku Limau' },
  { code: '19.06.01.2012', name: 'Mekar Jaya' },
  { code: '19.06.01.2013', name: 'Bentaian Jaya' },
  { code: '19.06.02.2001', name: 'Gantung' },
  { code: '19.06.02.2002', name: 'Selingsing' },
  { code: '19.06.02.2003', name: 'Jangkar Asam' },
  { code: '19.06.02.2004', name: 'Lilangan' },
  { code: '19.06.02.2009', name: 'Lenggang' },
  { code: '19.06.02.2010', name: 'Batu Penyu' },
  { code: '19.06.02.2011', name: 'Limbongan' },
  { code: '19.06.03.2001', name: 'Dendang' },
  { code: '19.06.03.2002', name: 'Jangkang' },
  { code: '19.06.03.2005', name: 'Nyuruk' },
  { code: '19.06.03.2008', name: 'Balok' },
  { code: '19.06.04.2001', name: 'Mentawak' },
  { code: '19.06.04.2002', name: 'Senyubuk' },
  { code: '19.06.04.2003', name: 'Cendil' },
  { code: '19.06.04.2005', name: 'Buding' },
  { code: '19.06.04.2006', name: 'Mayang' },
  { code: '19.06.04.2007', name: 'Pembaharuan' },
  { code: '19.06.05.2001', name: 'Air Kelik' },
  { code: '19.06.05.2002', name: 'Mempaya' },
  { code: '19.06.05.2003', name: 'Burong Mandi' },
  { code: '19.06.05.2004', name: 'Mengkubang' },
  { code: '19.06.05.2005', name: 'Sukamandi' },
  { code: '19.06.06.2001', name: 'Simpang Tiga' },
  { code: '19.06.06.2002', name: 'Renggiang' },
  { code: '19.06.06.2003', name: 'Aik Madu' },
  { code: '19.06.06.2004', name: 'Lintang' },
  { code: '19.06.07.2001', name: 'Simpang Pesak' },
  { code: '19.06.07.2002', name: 'Tanjung Batu Itam' },
  { code: '19.06.07.2003', name: 'Tanjung Kelumpang' },
  { code: '19.06.07.2004', name: 'Dukong' },
]);

const byCode = new Map(VILLAGES.map((village) => [village.code, village]));
const districtName = new Map(DISTRICTS.map((district) => [district.code, district.name]));
export const STREET_MIN = 5;
export const STREET_MAX = 200;

/** "Kel." for kelurahan (code 1xxx), "Desa" for desa (2xxx). */
export const villageKind = (code) => (code.slice(-4, -3) === '1' ? 'Kelurahan' : 'Desa');
const villageShort = (code) => (villageKind(code) === 'Kelurahan' ? 'Kel.' : 'Desa');

/** Full description of a desa/kelurahan, or null for an unknown code. */
export function findVillage(code) {
  const village = typeof code === 'string' ? byCode.get(code) : null;
  if (!village) return null;
  const district = code.slice(0, 8);
  const regency = code.slice(0, 5);
  return {
    code,
    name: village.name,
    kind: villageKind(code),
    districtCode: district,
    district: districtName.get(district),
    regencyCode: regency,
    regency: REGENCIES[regency],
  };
}
export const villagesIn = (districtCode) =>
  VILLAGES.filter((village) => !districtCode || village.code.startsWith(districtCode + '.'));
export const districtsIn = (regencyCode) =>
  DISTRICTS.filter((district) => !regencyCode || district.code.startsWith(regencyCode + '.'));

/** The single address line stored with the account and printed on orders. */
export function composeAddress(street, code) {
  const village = findVillage(code);
  const line = typeof street === 'string' ? street.trim().replace(/\s+/g, ' ') : '';
  if (!village || !line) return '';
  return [
    line,
    `${villageShort(code)} ${village.name}`,
    `Kec. ${village.district}`,
    village.regency.replace('Kabupaten', 'Kab.'),
    PROVINCE,
  ].join(', ');
}

/** Errors for the street + desa/kelurahan pair, keyed `jalan` and `desa`. */
export function validateArea({ jalan, desa } = {}) {
  const errors = {};
  const line = typeof jalan === 'string' ? jalan.trim() : '';
  if (line.length < STREET_MIN || line.length > STREET_MAX)
    errors.jalan = `Isi nama jalan dan nomor rumah (${STREET_MIN}–${STREET_MAX} karakter).`;
  if (!findVillage(desa)) errors.desa = 'Pilih kelurahan atau desa di Pulau Belitung.';
  return errors;
}
