// Sample catalog for the seed script: 6 categories x 15 products. Prices are realistic PKR retail
// prices (Oct 2026, approximate). `on`: which platforms list it (d = Daraz, p = PriceOye, a = AliExpress).
// AliExpress is the supplier source: its price is derived from the retail price (see seed.js).
// Fashion is not sold on PriceOye, so those products have 2 stores (matching is strongest in electronics).

const mobiles = [
  { b: 'Apple', t: 'Apple iPhone 16 128GB', p: 329999, on: 'dp' },
  { b: 'Apple', t: 'Apple iPhone 15 128GB', p: 264999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy S25 12GB 256GB', p: 284999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy A55 5G 8GB 256GB', p: 119999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy A16 6GB 128GB', p: 52999, on: 'dp' },
  { b: 'Xiaomi', t: 'Xiaomi Redmi Note 14 8GB 256GB', p: 59999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi 14T 12GB 512GB', p: 154999, on: 'dpa' },
  { b: 'Google', t: 'Google Pixel 9 12GB 256GB', p: 229999, on: 'dpa' },
  { b: 'Infinix', t: 'Infinix Note 40 8GB 256GB', p: 49999, on: 'dp' },
  { b: 'Tecno', t: 'Tecno Spark 30 8GB 128GB', p: 37999, on: 'dp' },
  { b: 'Vivo', t: 'Vivo Y29 8GB 256GB', p: 51999, on: 'dp' },
  { b: 'Oppo', t: 'Oppo A3 6GB 128GB', p: 44999, on: 'dp' },
  { b: 'Realme', t: 'Realme C75 8GB 256GB', p: 46999, on: 'dpa' },
  { b: 'Honor', t: 'Honor X9c 5G 8GB 256GB', p: 69999, on: 'dpa' },
  { b: 'Nothing', t: 'Nothing Phone 3a 8GB 256GB', p: 109999, on: 'dpa' },
];

const laptops = [
  { b: 'Apple', t: 'Apple MacBook Air M3 13in 8GB 256GB', p: 339999, on: 'dpa' },
  { b: 'Apple', t: 'Apple MacBook Air M2 13in 8GB 256GB', p: 259999, on: 'dpa' },
  { b: 'Apple', t: 'Apple MacBook Pro 14in M3 8GB 512GB', p: 449999, on: 'dp' },
  { b: 'HP', t: 'HP Victus 15 Core i5 12450H 16GB 512GB RTX 3050', p: 214999, on: 'dp' },
  { b: 'HP', t: 'HP 15 Core i5 1235U 8GB 512GB', p: 124999, on: 'dp' },
  { b: 'HP', t: 'HP EliteBook 840 G8 Core i5 1135G7 16GB 512GB', p: 159999, on: 'dp' },
  { b: 'Lenovo', t: 'Lenovo IdeaPad Slim 3 Core i5 13420H 8GB 512GB', p: 149999, on: 'dp' },
  { b: 'Lenovo', t: 'Lenovo ThinkPad E14 Core i5 1335U 16GB 512GB', p: 209999, on: 'dp' },
  { b: 'Dell', t: 'Dell Inspiron 15 3520 Core i5 1235U 8GB 512GB', p: 159999, on: 'dp' },
  { b: 'Dell', t: 'Dell Latitude 5420 Core i5 1145G7 16GB 256GB', p: 89999, on: 'dp' },
  { b: 'Asus', t: 'Asus VivoBook 15 Core i3 1215U 8GB 512GB', p: 114999, on: 'dpa' },
  { b: 'Asus', t: 'Asus TUF Gaming F15 Core i5 12500H 16GB 512GB RTX 3050', p: 224999, on: 'dp' },
  { b: 'Acer', t: 'Acer Aspire 7 Core i5 12450H 16GB 512GB', p: 189999, on: 'dp' },
  { b: 'Acer', t: 'Acer Nitro V15 Core i5 13420H 16GB 512GB RTX 4050', p: 244999, on: 'dp' },
  { b: 'MSI', t: 'MSI Thin 15 Core i5 12450H 16GB 512GB RTX 2050', p: 194999, on: 'dp' },
];

const audio = [
  { b: 'Apple', t: 'Apple AirPods Pro 2 USB-C', p: 64999, on: 'dpa' },
  { b: 'Apple', t: 'Apple AirPods 4', p: 44999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy Buds FE', p: 17999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy Buds3 Pro', p: 59999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi Redmi Buds 6 Active', p: 4999, on: 'dpa' },
  { b: 'JBL', t: 'JBL Tune 520BT Wireless Headphones', p: 11999, on: 'dpa' },
  { b: 'JBL', t: 'JBL Flip 6 Portable Bluetooth Speaker', p: 27999, on: 'dpa' },
  { b: 'JBL', t: 'JBL Charge 5 Portable Bluetooth Speaker', p: 54999, on: 'dpa' },
  { b: 'Sony', t: 'Sony WH-1000XM5 Wireless Headphones', p: 94999, on: 'dpa' },
  { b: 'Sony', t: 'Sony WF-1000XM5 Wireless Earbuds', p: 69999, on: 'dpa' },
  { b: 'Anker', t: 'Anker Soundcore Life Q30 Headphones', p: 16999, on: 'dpa' },
  { b: 'Anker', t: 'Anker Soundcore P40i Earbuds', p: 13999, on: 'dpa' },
  { b: 'Haylou', t: 'Haylou GT7 Neo Earbuds', p: 3499, on: 'dpa' },
  { b: 'Audionic', t: 'Audionic Airbud 625 Earbuds', p: 3999, on: 'dp' },
  { b: 'QCY', t: 'QCY T13 ANC Earbuds', p: 4499, on: 'da' },
];

const watches = [
  { b: 'Apple', t: 'Apple Watch Series 10 46mm', p: 134999, on: 'dpa' },
  { b: 'Apple', t: 'Apple Watch SE 2 44mm', p: 74999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy Watch 7 44mm', p: 64999, on: 'dpa' },
  { b: 'Samsung', t: 'Samsung Galaxy Watch FE 40mm', p: 36999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi Redmi Watch 5 Active', p: 8999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi Smart Band 9', p: 8499, on: 'dpa' },
  { b: 'Amazfit', t: 'Amazfit GTS 4 Mini Smart Watch', p: 17999, on: 'dpa' },
  { b: 'Amazfit', t: 'Amazfit Bip 5 Smart Watch', p: 13999, on: 'dpa' },
  { b: 'Amazfit', t: 'Amazfit Active 2 Smart Watch', p: 22999, on: 'dpa' },
  { b: 'Huawei', t: 'Huawei Band 9 Fitness Tracker', p: 11999, on: 'dpa' },
  { b: 'Huawei', t: 'Huawei Watch GT 5 46mm', p: 62999, on: 'dpa' },
  { b: 'Haylou', t: 'Haylou Solar Plus RT3 Smart Watch', p: 7999, on: 'dpa' },
  { b: 'Casio', t: 'Casio G-Shock GA-2100-1A Watch', p: 28999, on: 'da' },
  { b: 'Casio', t: 'Casio F-91W Digital Watch', p: 4299, on: 'da' },
  { b: 'Garmin', t: 'Garmin Forerunner 55 GPS Watch', p: 48999, on: 'dpa' },
];

const homeAppliances = [
  { b: 'Xiaomi', t: 'Xiaomi Robot Vacuum S10', p: 74999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi Smart Air Purifier 4 Lite', p: 28999, on: 'dpa' },
  { b: 'Xiaomi', t: 'Xiaomi TV Stick 4K', p: 11999, on: 'dpa' },
  { b: 'Philips', t: 'Philips Air Fryer HD9252', p: 34999, on: 'dp' },
  { b: 'Philips', t: 'Philips HD7432 Coffee Maker', p: 11999, on: 'dp' },
  { b: 'Philips', t: 'Philips GC1905 Steam Iron', p: 6499, on: 'dp' },
  { b: 'Ninja', t: 'Ninja AF101 Air Fryer 3.8L', p: 36999, on: 'da' },
  { b: 'Instant', t: 'Instant Pot Duo 7-in-1 Pressure Cooker 6L', p: 32999, on: 'da' },
  { b: 'Dyson', t: 'Dyson V8 Absolute Cordless Vacuum Cleaner', p: 144999, on: 'dpa' },
  { b: 'Kenwood', t: 'Kenwood HB 856 Hand Blender', p: 9999, on: 'dp' },
  { b: 'Anex', t: 'Anex AG-6043 Blender', p: 8999, on: 'd' },
  { b: 'Haier', t: 'Haier HSU-12HFPCAA 1 Ton Inverter AC', p: 129999, on: 'dp' },
  { b: 'Haier', t: 'Haier HWM 100-1789 Top Load Washing Machine 10kg', p: 94999, on: 'dp' },
  { b: 'TCL', t: 'TCL 43 Inch 4K Google TV 43P635', p: 59999, on: 'dp' },
  { b: 'TP-Link', t: 'TP-Link Archer C6 AC1200 Router', p: 8999, on: 'dpa' },
];

const fashion = [
  { b: 'Nike', t: 'Nike Air Force 1 07 Sneakers', p: 38999, on: 'da' },
  { b: 'Adidas', t: 'Adidas Samba OG Sneakers', p: 34999, on: 'da' },
  { b: 'Puma', t: 'Puma Smash v2 Sneakers', p: 11999, on: 'da' },
  { b: 'Skechers', t: 'Skechers Go Walk 6 Shoes', p: 14999, on: 'da' },
  { b: 'Converse', t: 'Converse Chuck Taylor All Star 70 High Top', p: 19999, on: 'da' },
  { b: 'Vans', t: 'Vans Old Skool Sneakers', p: 17999, on: 'da' },
  { b: 'Crocs', t: 'Crocs Classic Clog', p: 8999, on: 'da' },
  { b: 'Levis', t: 'Levis 501 Original Fit Jeans', p: 17999, on: 'da' },
  { b: 'Levis', t: 'Levis 511 Slim Fit Jeans', p: 16999, on: 'da' },
  { b: 'Adidas', t: 'Adidas Originals Trefoil Hoodie', p: 13999, on: 'da' },
  { b: 'Nike', t: 'Nike Dri-FIT Running T-Shirt', p: 5499, on: 'da' },
  { b: 'Ray-Ban', t: 'Ray-Ban Wayfarer RB2140 Sunglasses', p: 34999, on: 'da' },
  { b: 'Ray-Ban', t: 'Ray-Ban Aviator RB3025 Sunglasses', p: 37999, on: 'da' },
  { b: 'Fjallraven', t: 'Fjallraven Kanken Classic Backpack', p: 29999, on: 'da' },
  { b: 'Herschel', t: 'Herschel Little America Backpack', p: 27999, on: 'da' },
];

const withCategory = (items, c) => items.map((i) => ({ ...i, c }));

module.exports = [
  ...withCategory(mobiles, 'Mobiles'),
  ...withCategory(laptops, 'Laptops'),
  ...withCategory(audio, 'Audio'),
  ...withCategory(watches, 'Watches'),
  ...withCategory(homeAppliances, 'Home Appliances'),
  ...withCategory(fashion, 'Fashion'),
];
