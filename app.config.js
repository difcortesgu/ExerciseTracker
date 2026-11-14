// Dynamic Expo config (ADR-003): app.json plus the CI build number. Without APP_BUILD_NUMBER (Expo
// Go, local development) the static config is returned unchanged.
const { withReleaseBuildNumber } = require('./tooling/release/app-config');

module.exports = ({ config }) => withReleaseBuildNumber(config, process.env);
