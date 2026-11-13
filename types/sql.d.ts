/**
 * `.sql` files are inlined as strings at build time by babel-plugin-inline-import
 * (babel.config.js), identically in Metro and Jest. Used for drizzle-kit migrations (ADR-001).
 */
declare module '*.sql' {
  const sql: string;
  export default sql;
}
