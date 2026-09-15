// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions roda no Deno (Edge Functions), com outro ambiente de tipos.
    ignores: ['dist/*', 'docs/*', '.expo/*', 'supabase/functions/**'],
  },
]);
