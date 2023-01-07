<div align="center">
  <a href="https://www.npmjs.com/package/genzo">
    <img width="120" height="120" hspace="10"
      src="https://images2.imgbox.com/bc/cd/sxR54KnL_o.png" alt="genzo logo">
  </a>
 <h1>genzo</h1>
  <p>
    Rapidly scaffold your projects for development with custom templates
  </p>
</div>

<div align="center">
  <img src="https://img.shields.io/node/v/genzo" alt="node-current" />
  <img alt="GitHub Workflow Status" src="https://img.shields.io/github/actions/workflow/status/fatehak/genzo-cli/validate_build.yaml">
  <img src="https://img.shields.io/github/v/release/fatehak/genzo-cli" alt="GitHub release" />
  <img src="https://img.shields.io/npm/l/genzo" alt="licence" />
</div>

### Features

- Fetch your custom templates stored in GitHub or your local file system.
- Fuzzy searches your list of templates for convenience and ease of use.
- Interactive prompts using [Inquirer](https://www.npmjs.com/package/inquirer) to automate common tasks in repository setup.
- Can detect a Monorepo template and install deps in all packages.
- Checks the presence of [Husky](https://www.npmjs.com/package/husky) scripts and makes them executable so you don't have to!
- Make use of slots to quickly replace repeated patterns in the generated repository.
- Supports CLI arguments to automatically initialize Git, install packages and open your preferred code editor.

### Demo

- Fetching templates from GitHub

![general usage](https://images2.imgbox.com/27/68/DqPhlgQc_o.gif)

- Using a local Monorepo template and auto-setup git and packages without prompting the user with the `-gi` flag

![monorepo usage](https://images2.imgbox.com/bd/12/7Qwxmkql_o.gif)

Templates created by me for reference - https://github.com/FatehAK/dev-templates

### Installation

```shell
npm install -g genzo
```

Create a `.genzorc.js` file in your `$HOME` directory. Refer [config](#configuration) for more details.

### Usage

```console
gen [OPTIONS] | genzo [OPTIONS]

OPTIONS:
  -h, --help             show this message and exit
  -v, --version          print the version string
  -g, --git              auto-initialize a git repository
  -i, --install          auto-install packages
  -e, --editor           opens the editor defined in config
  -e, --editor <string>  opens the specified editor

EXAMPLES:
  gen -g                 # auto-initializes a git repository without querying the user
  gen -i                 # auto-installs packages without querying the user
  gen -e                 # opens the generated repository in the editor defined in config
  gen -e code            # opens the generated repository in the specified editor (i.e VSCode)
  gen -gie               # does git init, installs packages and opens the editor defined in config
  gen -gi -e code        # does git init, installs packages and opens the specified editor (i.e VSCode)
```

### Configuration

The configuration must be defined in `.genzorc.js` and placed in the system's `$HOME` directory.

An example configuration:

```js
module.exports = {
  templatePath: 'https://api.github.com/repos/fatehak/dev-templates/contents/templates',
  githubToken: 'aNoiceToken',
  authorName: 'YOUR_NAME',
  slotPaths: ['**/.github/**', '**/package.json', '**/README.md'],
  slots: {
    '[SOME_VAR]': 'some_value',
  },
  editorBinary: 'code',
};
```

### `templatePath`

Type: `String` Default: `undefined`

Accepts a GitHub repository path or an absolute path to the templates in your local system.

The GitHub repository path must in the format `https://api.github.com/repos/${USER}/${REPO}/contents/path_to_templates`

```js
templatePath: 'https://api.github.com/repos/fatehak/dev-templates/contents/templates'
```

Or you can pass an absolute path to your templates stored locally

```js
templatePath: '/Users/myuser/Dev/my-templates'
```

### `githubToken`

Type: `String` Default: `undefined`

Optionally pass a GitHub token to avoid hitting GitHub's rate limiter. Only required if `templatePath` is a GitHub repository. It is mandatory to pass the token for private repositories.

Check this [link](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for details on creating a token.

### `authorName`

Type: `String` Default: `undefined`

The default author name to be used while creating the repository. If this value is present then the CLI will skip asking the author name query.

### `slotPaths`

Type: `Array[String]` Default: `[]`

An array of minimatch glob patterns that point to files with slots to replace.

```js
slotPaths: ['**/.github/**', '**/package.json']
```

The above example will replace slots defined in `.github` folder and `.package.json`

### `slots`

Type: `Object` Default: `undefined`

An object with slot name-value mapping. The CLI will replace these slots with their corresponding values within files.

```js
slots: {
  '[AUTHOR_NAME]': 'your_name'
}
```

The above example will replace all occurences of `[AUTHOR_NAME]` with `your_name` in matching files defined in `slotPaths`

By default, `[AUTHOR_NAME]` and `[REPO_NAME]` slots will be replaced in the generated repository based on user input.

### `editorBinary`

Type: `String` Default: `undefined`

Path to an editor binary. This will be used to optionally open the repository at the end of the genzo session.

```js
editorBinary: '/Users/my_user/Library/Application Support/JetBrains/Toolbox/scripts/webstorm'
```

or you can also specify an alias to an editor binary, for example to open VSCode

```js
editorBinary: 'code'
```

### License

[MIT](./LICENSE)
