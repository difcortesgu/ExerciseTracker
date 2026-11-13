import { createToken } from '@shared/application/di/token';

import { createContainer } from './container';

interface Greeter {
  greet(name: string): string;
}

const GreeterToken = createToken<Greeter>('test.Greeter');
const PrefixToken = createToken<string>('test.Prefix');

const prefixedGreeter = (prefix: string): Greeter => ({ greet: (name) => `${prefix} ${name}` });

describe('createContainer', () => {
  describe('resolve', () => {
    it('returns the registered implementation with its static type', () => {
      const container = createContainer().register(GreeterToken, () => prefixedGreeter('Hello'));

      const greeter: Greeter = container.resolve(GreeterToken);

      expect(greeter.greet('Ada')).toBe('Hello Ada');
    });

    it('throws a programmer error naming a token that was never registered', () => {
      const container = createContainer();

      expect(() => container.resolve(GreeterToken)).toThrow(/test\.Greeter/);
    });

    it('lets factories resolve their own dependencies', () => {
      const container = createContainer()
        .register(PrefixToken, () => 'Hi')
        .register(GreeterToken, (resolver) => prefixedGreeter(resolver.resolve(PrefixToken)));

      expect(container.resolve(GreeterToken).greet('Ada')).toBe('Hi Ada');
    });

    it('tells tokens with the same description apart', () => {
      const otherPrefixToken = createToken<string>('test.Prefix');
      const container = createContainer()
        .register(PrefixToken, () => 'first')
        .register(otherPrefixToken, () => 'second');

      expect(container.resolve(PrefixToken)).toBe('first');
      expect(container.resolve(otherPrefixToken)).toBe('second');
    });
  });

  describe('lifetimes', () => {
    it('runs a singleton factory lazily, once, by default', () => {
      const factory = jest.fn(() => prefixedGreeter('Hello'));
      const container = createContainer().register(GreeterToken, factory);

      expect(factory).not.toHaveBeenCalled();
      const first = container.resolve(GreeterToken);
      const second = container.resolve(GreeterToken);

      expect(first).toBe(second);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('runs a transient factory on every resolve', () => {
      const factory = jest.fn(() => prefixedGreeter('Hello'));
      const container = createContainer().register(GreeterToken, factory, {
        lifetime: 'transient',
      });

      const first = container.resolve(GreeterToken);
      const second = container.resolve(GreeterToken);

      expect(first).not.toBe(second);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('retries a singleton factory that threw, instead of caching the failure', () => {
      const factory = jest
        .fn<Greeter, []>()
        .mockImplementationOnce(() => {
          throw new Error('not ready');
        })
        .mockImplementation(() => prefixedGreeter('Hello'));
      const container = createContainer().register(GreeterToken, factory);

      expect(() => container.resolve(GreeterToken)).toThrow('not ready');
      expect(container.resolve(GreeterToken).greet('Ada')).toBe('Hello Ada');
    });
  });

  describe('replacing registrations (test containers)', () => {
    it('resolves the latest registration for a token', () => {
      const container = createContainer()
        .register(GreeterToken, () => prefixedGreeter('Real'))
        .register(GreeterToken, () => prefixedGreeter('Fake'));

      expect(container.resolve(GreeterToken).greet('Ada')).toBe('Fake Ada');
    });

    it('drops a cached singleton when its registration is replaced', () => {
      const container = createContainer().register(GreeterToken, () => prefixedGreeter('Real'));
      container.resolve(GreeterToken);

      container.register(GreeterToken, () => prefixedGreeter('Fake'));

      expect(container.resolve(GreeterToken).greet('Ada')).toBe('Fake Ada');
    });

    it('keeps separate containers independent', () => {
      const production = createContainer().register(GreeterToken, () => prefixedGreeter('Real'));
      const test = createContainer().register(GreeterToken, () => prefixedGreeter('Fake'));

      expect(test.resolve(GreeterToken).greet('Ada')).toBe('Fake Ada');
      expect(production.resolve(GreeterToken).greet('Ada')).toBe('Real Ada');
    });
  });
});
