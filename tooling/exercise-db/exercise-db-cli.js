#!/usr/bin/env node
// @ts-check
// Process entry point of the dataset conversion (S1-11): binds the tested `run()` to the real file
// system and process. Excluded from coverage; exercised end to end by exercise-db-cli.test.ts.
const fs = require('node:fs');

const { run } = require('./cli');

process.exitCode = run(process.argv.slice(2), {
  readFile: (path) => fs.readFileSync(path, 'utf8'),
  writeFile: (path, content) => fs.writeFileSync(path, content),
  fileExists: (path) => fs.existsSync(path),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
});
