import type { Token } from '@shared/application/di/token';

/**
 * Dependency Injection container (S0-15). `src/core/di` is the composition root: the only place
 * where infrastructure adapters are constructed (enforced by lint). Production wiring lives in
 * `composition-root.ts`; tests build their own container with `createContainer()` and fakes.
 */

/** `singleton` (default): factory runs once, lazily, on first resolve. `transient`: every resolve. */
export type Lifetime = 'singleton' | 'transient';

export interface RegistrationOptions {
  readonly lifetime?: Lifetime;
}

/** Builds an implementation; receives the resolver to obtain its own dependencies. */
export type Factory<T> = (resolver: Resolver) => T;

/** Read side, the only part presentation (via the React binding) and bootstrap code may see. */
export interface Resolver {
  /** Returns the registered implementation. Throws a programmer error naming the token if unregistered. */
  resolve<T>(token: Token<T>): T;
}

export interface Container extends Resolver {
  /** Registers (or replaces) the factory for `token`; returns the same container for chaining. */
  register<T>(token: Token<T>, factory: Factory<T>, options?: RegistrationOptions): Container;
}

const DEFAULT_LIFETIME: Lifetime = 'singleton';

interface Registration<T> {
  readonly key: symbol;
  readonly factory: Factory<T>;
  readonly lifetime: Lifetime;
  /** Lazily created singleton instance; wrapped so `undefined` can be a valid instance. */
  cached?: { readonly instance: T };
}

/**
 * A registration is stored under its token's unique key and can only be created through
 * `register<T>(token: Token<T>, factory: Factory<T>)`, so a matching key proves the type.
 */
function isRegistrationFor<T>(
  registration: Registration<unknown>,
  token: Token<T>,
): registration is Registration<T> {
  return registration.key === token.key;
}

function instantiate<T>(registration: Registration<T>, resolver: Resolver): T {
  if (registration.lifetime === 'transient') {
    return registration.factory(resolver);
  }
  registration.cached ??= { instance: registration.factory(resolver) };
  return registration.cached.instance;
}

/** Creates an empty container. Registrations default to a lazy singleton lifetime. */
export function createContainer(): Container {
  const registrations = new Map<symbol, Registration<unknown>>();

  const container: Container = {
    register(token, factory, options = {}) {
      const lifetime = options.lifetime ?? DEFAULT_LIFETIME;
      registrations.set(token.key, { key: token.key, factory, lifetime });
      return container;
    },
    resolve(token) {
      const registration = registrations.get(token.key);
      if (registration === undefined || !isRegistrationFor(registration, token)) {
        throw new Error(`No registration for token "${token.description}" in the DI container.`);
      }
      return instantiate(registration, container);
    },
  };
  return container;
}
