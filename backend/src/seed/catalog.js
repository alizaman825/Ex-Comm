// Sample catalog for the seed script. Prices are realistic PKR street prices (Oct 2026, approximate).
// on: which platforms list it — d = Daraz, p = PriceOye, a = AliExpress.
// AliExpress prices are USD converted to PKR at a fixed rate (see docs/report_notes.md).

module.exports = [
  // Mobiles
  { c: 'Mobiles', b: 'Apple', t: 'Apple iPhone 16 128GB', p: 329999, on: 'dp' },
  { c: 'Mobiles', b: 'Apple', t: 'Apple iPhone 15 128GB', p: 264999, on: 'dpa' },
  { c: 'Mobiles', b: 'Samsung', t: 'Samsung Galaxy S25 12GB 256GB', p: 284999, on: 'dpa' },
  { c: 'Mobiles', b: 'Samsung', t: 'Samsung Galaxy A55 5G 8GB 256GB', p: 119999, on: 'dpa' },
  { c: 'Mobiles', b: 'Samsung', t: 'Samsung Galaxy A16 6GB 128GB', p: 52999, on: 'dp' },
  { c: 'Mobiles', b: 'Xiaomi', t: 'Xiaomi Redmi Note 14 8GB 256GB', p: 59999, on: 'dpa' },
  { c: 'Mobiles', b: 'Xiaomi', t: 'Xiaomi 14T 12GB 512GB', p: 154999, on: 'dpa' },
  { c: 'Mobiles', b: 'Google', t: 'Google Pixel 9 12GB 256GB', p: 229999, on: 'dpa' },
  { c: 'Mobiles', b: 'Infinix', t: 'Infinix Note 40 8GB 256GB', p: 49999, on: 'dp' },
  { c: 'Mobiles', b: 'Tecno', t: 'Tecno Spark 30 8GB 128GB', p: 37999, on: 'dp' },
  { c: 'Mobiles', b: 'Vivo', t: 'Vivo Y29 8GB 256GB', p: 51999, on: 'dp' },
  { c: 'Mobiles', b: 'Oppo', t: 'Oppo A3 6GB 128GB', p: 44999, on: 'dp' },
  { c: 'Mobiles', b: 'Realme', t: 'Realme C75 8GB 256GB', p: 46999, on: 'dpa' },

  // Audio
  { c: 'Audio', b: 'Apple', t: 'Apple AirPods Pro 2 USB-C', p: 64999, on: 'dpa' },
  { c: 'Audio', b: 'Samsung', t: 'Samsung Galaxy Buds FE', p: 17999, on: 'dpa' },
  { c: 'Audio', b: 'Xiaomi', t: 'Xiaomi Redmi Buds 6 Active', p: 4999, on: 'dpa' },
  { c: 'Audio', b: 'JBL', t: 'JBL Tune 520BT Wireless Headphones', p: 11999, on: 'dpa' },
  { c: 'Audio', b: 'Sony', t: 'Sony WH-1000XM5 Wireless Headphones', p: 94999, on: 'dpa' },
  { c: 'Audio', b: 'Anker', t: 'Anker Soundcore Life Q30 Headphones', p: 16999, on: 'dpa' },
  { c: 'Audio', b: 'JBL', t: 'JBL Flip 6 Portable Bluetooth Speaker', p: 27999, on: 'dpa' },
  { c: 'Audio', b: 'Audionic', t: 'Audionic Airbud 625 Earbuds', p: 3999, on: 'dp' },
  { c: 'Audio', b: 'QCY', t: 'QCY T13 ANC Earbuds', p: 4499, on: 'da' },

  // Wearables
  { c: 'Wearables', b: 'Apple', t: 'Apple Watch SE 2 44mm', p: 74999, on: 'dpa' },
  { c: 'Wearables', b: 'Samsung', t: 'Samsung Galaxy Watch 7 44mm', p: 64999, on: 'dpa' },
  { c: 'Wearables', b: 'Xiaomi', t: 'Xiaomi Redmi Watch 5 Active', p: 8999, on: 'dpa' },
  { c: 'Wearables', b: 'Amazfit', t: 'Amazfit GTS 4 Mini Smart Watch', p: 17999, on: 'dpa' },
  { c: 'Wearables', b: 'Huawei', t: 'Huawei Band 9 Fitness Tracker', p: 11999, on: 'dpa' },
  { c: 'Wearables', b: 'Haylou', t: 'Haylou Solar Plus RT3 Smart Watch', p: 7999, on: 'dpa' },

  // Laptops
  { c: 'Laptops', b: 'Apple', t: 'Apple MacBook Air M3 13in 8GB 256GB', p: 339999, on: 'dpa' },
  { c: 'Laptops', b: 'HP', t: 'HP Victus 15 Core i5 12450H 16GB 512GB RTX 3050', p: 214999, on: 'dp' },
  { c: 'Laptops', b: 'Lenovo', t: 'Lenovo IdeaPad Slim 3 Core i5 13420H 8GB 512GB', p: 149999, on: 'dp' },
  { c: 'Laptops', b: 'Dell', t: 'Dell Inspiron 15 3520 Core i5 1235U 8GB 512GB', p: 159999, on: 'dp' },
  { c: 'Laptops', b: 'Asus', t: 'Asus VivoBook 15 Core i3 1215U 8GB 512GB', p: 114999, on: 'dpa' },
  { c: 'Laptops', b: 'Acer', t: 'Acer Aspire 7 Core i5 12450H 16GB 512GB', p: 189999, on: 'dp' },

  // Tablets
  { c: 'Tablets', b: 'Apple', t: 'Apple iPad 10th Generation 64GB WiFi', p: 119999, on: 'dpa' },
  { c: 'Tablets', b: 'Samsung', t: 'Samsung Galaxy Tab A9 Plus 8GB 128GB', p: 54999, on: 'dpa' },
  { c: 'Tablets', b: 'Xiaomi', t: 'Xiaomi Pad 6 8GB 256GB', p: 84999, on: 'dpa' },

  // Accessories
  { c: 'Accessories', b: 'Anker', t: 'Anker 20W USB-C Charger', p: 3999, on: 'dpa' },
  { c: 'Accessories', b: 'Baseus', t: 'Baseus 20000mAh 22.5W Power Bank', p: 6999, on: 'dpa' },
  { c: 'Accessories', b: 'Logitech', t: 'Logitech M331 Silent Wireless Mouse', p: 3999, on: 'dpa' },
  { c: 'Accessories', b: 'Logitech', t: 'Logitech K380 Bluetooth Keyboard', p: 8999, on: 'dpa' },
  { c: 'Accessories', b: 'SanDisk', t: 'SanDisk Ultra 128GB microSD Card', p: 2999, on: 'dpa' },
  { c: 'Accessories', b: 'Samsung', t: 'Samsung T7 1TB Portable SSD', p: 27999, on: 'dpa' },
  { c: 'Accessories', b: 'Ugreen', t: 'Ugreen 6 in 1 USB-C Hub', p: 5999, on: 'da' },
  { c: 'Accessories', b: 'Xiaomi', t: 'Xiaomi 33W Fast Charger', p: 3499, on: 'dpa' },

  // Gaming
  { c: 'Gaming', b: 'Sony', t: 'Sony PlayStation 5 Slim Digital Edition', p: 149999, on: 'dpa' },
  { c: 'Gaming', b: 'Sony', t: 'Sony DualSense Wireless Controller', p: 21999, on: 'dpa' },
  { c: 'Gaming', b: 'Microsoft', t: 'Microsoft Xbox Wireless Controller', p: 17999, on: 'dpa' },
  { c: 'Gaming', b: 'Nintendo', t: 'Nintendo Switch OLED', p: 94999, on: 'dpa' },
  { c: 'Gaming', b: 'Redragon', t: 'Redragon K552 Kumara Mechanical Keyboard', p: 8999, on: 'da' },
  { c: 'Gaming', b: 'Logitech', t: 'Logitech G102 Lightsync Gaming Mouse', p: 4499, on: 'dpa' },

  // Home & Kitchen
  { c: 'Home & Kitchen', b: 'Xiaomi', t: 'Xiaomi Robot Vacuum S10', p: 74999, on: 'dpa' },
  { c: 'Home & Kitchen', b: 'Philips', t: 'Philips Air Fryer HD9252', p: 34999, on: 'dp' },
  { c: 'Home & Kitchen', b: 'Anex', t: 'Anex AG-6043 Blender', p: 8999, on: 'd' },
  { c: 'Home & Kitchen', b: 'Philips', t: 'Philips GC1905 Steam Iron', p: 6499, on: 'dp' },
  { c: 'Home & Kitchen', b: 'TP-Link', t: 'TP-Link Archer C6 AC1200 Router', p: 8999, on: 'dpa' },
  { c: 'Home & Kitchen', b: 'Xiaomi', t: 'Xiaomi TV Stick 4K', p: 11999, on: 'dpa' },

  // Cameras
  { c: 'Cameras', b: 'GoPro', t: 'GoPro HERO12 Black', p: 109999, on: 'dpa' },
  { c: 'Cameras', b: 'DJI', t: 'DJI Osmo Pocket 3', p: 159999, on: 'dpa' },
  { c: 'Cameras', b: 'Canon', t: 'Canon EOS 2000D DSLR with 18-55mm Lens', p: 139999, on: 'dp' },
];
