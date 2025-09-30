const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');
const minify = watch ? process.argv.includes('--minify') : !process.argv.includes('--no-minify');

const ctx = esbuild.context({
  entryPoints: ['src/cli.ts'],
  tsconfig: './tsconfig.json',
  bundle: true,
  external: [],
  sourcemap: !minify,
  minify,
  platform: 'node',
  outfile: 'out/cli.js',
});

ctx
  .then(ctx => (watch ? ctx.watch() : ctx.rebuild()))
  .then(
    () => !watch && process.exit(0),
    () => process.exit(1),
  );
