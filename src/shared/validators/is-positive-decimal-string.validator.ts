import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import Decimal from 'decimal.js';

@ValidatorConstraint({ name: 'isPositiveDecimalString', async: false })
export class IsPositiveDecimalStringConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !/^\d+(\.\d{1,4})?$/.test(value)) {
      return false;
    }
    try {
      return new Decimal(value).greaterThan(0);
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'amount deve ser uma string decimal positiva com até 4 casas (ex: "150.00")';
  }
}

export function IsPositiveDecimalString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPositiveDecimalStringConstraint,
    });
  };
}
