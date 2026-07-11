import { IsPositiveDecimalStringConstraint } from './is-positive-decimal-string.validator';

describe('IsPositiveDecimalStringConstraint', () => {
  const constraint = new IsPositiveDecimalStringConstraint();

  it.each(['150.00', '0.01', '10', '10.5', '123456789012345'])(
    'accepts valid positive decimal string %s',
    (value) => {
      expect(constraint.validate(value)).toBe(true);
    },
  );

  it.each([
    '0',
    '0.00',
    '-10.00',
    'abc',
    '10.12345',
    '',
    '10.',
    '1234567890123456',
    12 as unknown as string,
    null as unknown as string,
  ])('rejects invalid value %s', (value) => {
    expect(constraint.validate(value)).toBe(false);
  });
});
