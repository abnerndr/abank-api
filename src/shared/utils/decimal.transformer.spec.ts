import Decimal from 'decimal.js';
import { decimalTransformer } from './decimal.transformer';

describe('decimalTransformer', () => {
  it('converts a Decimal to a fixed 4-decimal string for storage', () => {
    expect(decimalTransformer.to(new Decimal('10.5'))).toBe('10.5000');
  });

  it('converts a stored numeric string back into a Decimal', () => {
    const result = decimalTransformer.from('10.5000');
    expect(result).toBeInstanceOf(Decimal);
    expect((result as Decimal).equals(new Decimal('10.5'))).toBe(true);
  });

  it('passes through null and undefined untouched', () => {
    expect(decimalTransformer.to(null)).toBeNull();
    expect(decimalTransformer.to(undefined)).toBeUndefined();
    expect(decimalTransformer.from(null)).toBeNull();
    expect(decimalTransformer.from(undefined)).toBeUndefined();
  });
});
