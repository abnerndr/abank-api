import { createId, init } from '@paralleldrive/cuid2';

export class Cuid2Generator {
  private static cuid2: ReturnType<typeof init>;

  static init(length: number) {
    this.cuid2 = init({
      random: Math.random,
      length,
      fingerprint: 'cuid2-generator',
    });
  }

  static generate(length: number = 12) {
    if (!this.cuid2) {
      this.init(length);
    }
    return createId();
  }
}
