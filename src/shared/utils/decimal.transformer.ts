import Decimal from 'decimal.js';
import { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to(value?: Decimal | string | number | null): string | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return new Decimal(value).toFixed(4);
  },
  from(value?: string | null): Decimal | null | undefined {
    if (value === null || value === undefined) {
      return value;
    }
    return new Decimal(value);
  },
};
