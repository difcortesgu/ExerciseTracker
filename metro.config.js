// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// drizzle-kit migrations import .sql files; babel-plugin-inline-import inlines them (ADR-001).
config.resolver.sourceExts.push('sql');

module.exports = config;
