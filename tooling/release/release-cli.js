// @ts-check
/**
 * Process entry point of the release CLI: `node tooling/release/release-cli.js <command> [args]`.
 * Wiring only (excluded from coverage, exercised by release-cli.test.ts); logic lives in cli.js.
 */
const fs = require('node:fs');

const appJson = require('../../app.json');
const { run } = require('./cli');

process.exitCode = run(process.argv.slice(2), {
  env: process.env,
  appConfig: appJson.expo,
  readFile: (path) => fs.readFileSync(path, 'utf8'),
  writeFile: (path, content) => fs.writeFileSync(path, content),
  appendFile: (path, content) => fs.appendFileSync(path, content),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
});
