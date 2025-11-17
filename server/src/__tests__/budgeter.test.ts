import { Budgeter } from '../utils/budgeter.js';

describe('Budgeter', () => {
  test('packs components within budget', () => {
    const budgeter = new Budgeter({ inMax: 100, reserveOut: 0.3 });
    
    const components = [
      { name: 'high', content: 'High priority content', priority: 100 },
      { name: 'low', content: 'Low priority content', priority: 10 }
    ];

    const packed = budgeter.pack(components);
    expect(packed.length).toBeGreaterThan(0);
    expect(packed[0]).toContain('High priority');
  });

  test('respects priority ordering', () => {
    const budgeter = new Budgeter({ inMax: 50, reserveOut: 0.3 });
    
    const components = [
      { name: 'low', content: 'Low priority', priority: 10 },
      { name: 'high', content: 'High priority', priority: 100 }
    ];

    const packed = budgeter.pack(components);
    expect(packed[0]).toContain('High priority');
  });
});

