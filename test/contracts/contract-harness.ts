/**
 * Contract-test harness (S0-20). A contract suite is written once per port and run against every
 * implementation (in-memory fake and real adapter), proving they are interchangeable (Liskov).
 *
 * Usage:
 *   export const describeClockContract = defineContract<Clock>('Clock', (clock) => {
 *     it('…', () => { expect(clock().now()) … });
 *   });
 *   describeClockContract('SystemClock', () => new SystemClock());
 *
 * Each case gets a fresh subject (and `dispose` runs after it, e.g. to close a SQLite database).
 * Adding a contract for a new port never changes this file (Open/Closed).
 */

/** Creates a fresh subject per contract case; may be asynchronous. */
export type CreateSubject<Subject> = () => Subject | Promise<Subject>;

export interface SubjectLifecycle<Subject> {
  readonly create: CreateSubject<Subject>;
  readonly dispose?: (subject: Subject) => void | Promise<void>;
}

/** Registers the contract's `it` cases; `subject()` returns the current case's fresh subject. */
export type ContractCases<Subject> = (subject: () => Subject) => void;

/**
 * Runs a contract against one implementation. The fixture may carry more than the port (e.g. a
 * `close()` for its database); the cases only see the port, `dispose` sees the whole fixture.
 */
export type DescribeContract<Subject> = <Fixture extends Subject>(
  implementationName: string,
  subject: CreateSubject<Fixture> | SubjectLifecycle<Fixture>,
) => void;

function toLifecycle<Fixture>(
  subject: CreateSubject<Fixture> | SubjectLifecycle<Fixture>,
): SubjectLifecycle<Fixture> {
  return typeof subject === 'function' ? { create: subject } : subject;
}

export function defineContract<Subject>(
  portName: string,
  cases: ContractCases<Subject>,
): DescribeContract<Subject> {
  return <Fixture extends Subject>(
    implementationName: string,
    subject: CreateSubject<Fixture> | SubjectLifecycle<Fixture>,
  ) => {
    const { create, dispose } = toLifecycle(subject);

    describe(`${portName} contract: ${implementationName}`, () => {
      let current: { readonly subject: Fixture } | undefined;

      beforeEach(async () => {
        current = { subject: await create() };
      });

      afterEach(async () => {
        if (current !== undefined) {
          await dispose?.(current.subject);
        }
        current = undefined;
      });

      cases(() => {
        if (current === undefined) {
          throw new Error(`The ${portName} contract subject was read outside a test case.`);
        }
        return current.subject;
      });
    });
  };
}
