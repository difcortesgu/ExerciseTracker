import { render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { createContainer, type Container } from '@core/di/container';
import { createToken } from '@shared/application/di/token';

import { DependencyProvider, useDependency } from './dependency-provider';

interface Greeter {
  greet(): string;
}

const GreeterToken = createToken<Greeter>('test.Greeter');

function GreetingLabel() {
  const greeter = useDependency(GreeterToken);
  return <Text>{greeter.greet()}</Text>;
}

function wrapperFor(container: Container) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <DependencyProvider resolver={container}>{children}</DependencyProvider>;
  };
}

describe('DependencyProvider and useDependency', () => {
  it('gives components inside the provider the implementation registered for a token', async () => {
    const container = createContainer().register(GreeterToken, () => ({
      greet: () => 'Hello from the fake greeter',
    }));

    await render(
      <DependencyProvider resolver={container}>
        <GreetingLabel />
      </DependencyProvider>,
    );

    expect(screen.getByText('Hello from the fake greeter')).toBeOnTheScreen();
  });

  it('keeps the same instance across re-renders, even for transient registrations', async () => {
    const container = createContainer().register(GreeterToken, () => ({ greet: () => 'hi' }), {
      lifetime: 'transient',
    });
    const { result, rerender } = await renderHook(() => useDependency(GreeterToken), {
      wrapper: wrapperFor(container),
    });
    const firstInstance = result.current;

    await rerender({});

    expect(result.current).toBe(firstInstance);
  });

  it('throws a programmer error naming DependencyProvider when used outside the provider', async () => {
    const silenceReactErrorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(renderHook(() => useDependency(GreeterToken))).rejects.toThrow(
      /DependencyProvider/,
    );

    silenceReactErrorLog.mockRestore();
  });
});
