// Phase 4 Part C2/C4: the exact-duplicate merge plan used by scripts/dedup-identical-products.js - the
// live-site case this fixes is two separately-created "Infinix Note 60" products (ali's report, C1).
const { planMerges } = require('../src/services/dedupIdenticalProducts');

const id = (n) => `000000000000000000000${n}`.slice(-24);

describe('planMerges', () => {
  test('merges two products with the exact same title/brand/category onto the one with more listings', () => {
    const products = [
      { _id: id(1), title: 'Infinix Note 60', brand: 'Infinix', category: 'mobiles', minPrice: 104449 },
      { _id: id(2), title: 'Infinix Note 60', brand: 'Infinix', category: 'mobiles', minPrice: 114499 },
    ];
    const listingCountOf = new Map([[id(1), 8], [id(2), 1]]);
    const { byCategory, mergeableGroups, unsureGroups, moves } = planMerges(products, listingCountOf);

    expect(byCategory.get('mobiles')).toBe(1);
    expect(mergeableGroups).toBe(1);
    expect(unsureGroups).toBe(0);
    expect(moves).toEqual([{ from: products[1], to: products[0] }]);
  });

  test('is case/whitespace-insensitive on title and brand', () => {
    const products = [
      { _id: id(1), title: '  Infinix Note 60 ', brand: 'infinix', category: 'mobiles', minPrice: 100000 },
      { _id: id(2), title: 'Infinix Note 60', brand: 'INFINIX', category: 'mobiles', minPrice: 100000 },
    ];
    const { moves } = planMerges(products, new Map());
    expect(moves).toHaveLength(1);
  });

  test('a different brand or category is never merged, even with the same title', () => {
    const products = [
      { _id: id(1), title: 'Pro Max', brand: 'Apple', category: 'mobiles', minPrice: 300000 },
      { _id: id(2), title: 'Pro Max', brand: 'Samsung', category: 'mobiles', minPrice: 280000 },
      { _id: id(3), title: 'Pro Max', brand: 'Apple', category: 'watches', minPrice: 90000 },
    ];
    const { moves } = planMerges(products, new Map());
    expect(moves).toHaveLength(0);
  });

  test('leaves a group separate (unsure) when a candidate price is implausibly far from the keeper', () => {
    const products = [
      { _id: id(1), title: 'USB Cable', brand: 'Generic', category: null, minPrice: 500 },
      { _id: id(2), title: 'USB Cable', brand: 'Generic', category: null, minPrice: 50000 }, // 100x - clearly not the same listing
    ];
    const listingCountOf = new Map([[id(1), 3], [id(2), 1]]);
    const { mergeableGroups, unsureGroups, moves } = planMerges(products, listingCountOf);
    expect(unsureGroups).toBe(1);
    expect(mergeableGroups).toBe(0);
    expect(moves).toHaveLength(0);
  });

  test('a product with no price yet never blocks a merge', () => {
    const products = [
      { _id: id(1), title: 'New Gadget', brand: 'Acme', category: 'audio', minPrice: null },
      { _id: id(2), title: 'New Gadget', brand: 'Acme', category: 'audio', minPrice: 5000 },
    ];
    const { moves } = planMerges(products, new Map());
    expect(moves).toHaveLength(1);
  });

  test('three-way duplicate group keeps the one with the most listings and merges the other two', () => {
    const products = [
      { _id: id(1), title: 'Widget', brand: 'Acme', category: 'audio', minPrice: 1000 },
      { _id: id(2), title: 'Widget', brand: 'Acme', category: 'audio', minPrice: 1000 },
      { _id: id(3), title: 'Widget', brand: 'Acme', category: 'audio', minPrice: 1000 },
    ];
    const listingCountOf = new Map([[id(1), 1], [id(2), 5], [id(3), 2]]);
    const { moves } = planMerges(products, listingCountOf);
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.to._id === id(2))).toBe(true);
  });

  test('a unique product (no duplicate) produces no moves and no duplicate-group count', () => {
    const products = [{ _id: id(1), title: 'Only One', brand: 'Acme', category: 'audio', minPrice: 1000 }];
    const { byCategory, moves } = planMerges(products, new Map());
    expect(byCategory.size).toBe(0);
    expect(moves).toHaveLength(0);
  });
});
