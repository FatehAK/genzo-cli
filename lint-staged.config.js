const prettierCmd = `prettier --loglevel warn --cache --cache-strategy content --cache-location ./node_modules/.cache/.prettiercache --write`;

// TODO: by default eslint expect no warnings in commited code, adjust `--max-warnings` to change this behaviour
const eslintCmd = `eslint --max-warnings=0 --format=pretty --cache --cache-strategy content --cache-location ./node_modules/.cache/.eslintcache --fix`;

module.exports = {
  '**/*.js': [eslintCmd, prettierCmd],
  '**/*.{md,json,yaml,yml}': [prettierCmd],
};
