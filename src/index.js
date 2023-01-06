import os from 'os';
import { join, sep } from 'pathe';
import ansi from 'ansi-colors';
import minimist from 'minimist';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { version } from '../package.json';
import {
  downloadDirectory,
  callGitHubApi,
  copyDirectory,
  getLocalTemplates,
  initializeGit,
  installPackagesByPath,
  openInEditor,
  getHelpTemplate,
} from './utils';
import { CONFIG_FILE_NAME, GITHUB_PATH_REGEX, INQUIRER_DEFAULT_OPTS } from './constants';

(async function () {
  // get cli arguments
  const argv = minimist(process.argv.slice(2), {
    alias: {
      help: 'h',
      version: 'v',
      git: 'g',
      install: 'i',
      editor: 'e',
    },
  });

  // prints version string
  if (argv.version) {
    console.log(version);
    process.exit(0);
  }

  // prints help information
  if (argv.help) {
    console.log(getHelpTemplate());
    process.exit(0);
  }

  // check if config file and template path exists
  const homeDir = os.homedir();
  let config;
  try {
    config = (await import(join(homeDir, CONFIG_FILE_NAME))).default;
  } catch {
    console.log(ansi.red(`\nConfig file ${ansi.bold(CONFIG_FILE_NAME)} missing in home directory (${ansi.bold(homeDir)})`));
    process.exit(1);
  }
  if (!config.templatePath) {
    console.log(ansi.red(`\n${ansi.bold('templatePath')} missing in config file ${CONFIG_FILE_NAME}`));
    process.exit(1);
  }

  try {
    // STEP 1 - check if template path is a github url or local folder
    const isGithubPath = GITHUB_PATH_REGEX.test(config.templatePath);

    let templates;
    if (isGithubPath) {
      const spinner = createSpinner('Fetching templates from GitHub...\n').start();
      templates = await callGitHubApi(config.templatePath, config.githubToken);
      spinner.success({ text: 'Templates Fetched!\n' });
    } else {
      const spinner = createSpinner('Searching templates...\n').start();
      templates = await getLocalTemplates(config.templatePath);
      spinner.success({ text: `Templates located at ${ansi.cyan(config.templatePath)}\n` });
    }

    // STEP 2 - ask user to select a template and enter their repo name
    inquirer.registerPrompt('search-list', (await import('inquirer-search-list')).default); // register inquirer fuzzy search plugin
    const { inputTemplate, repoNameInput } = await inquirer.prompt([
      {
        type: 'search-list',
        message: 'Select a template',
        name: 'inputTemplate',
        choices: templates,
        ...INQUIRER_DEFAULT_OPTS,
      },
      {
        type: 'input',
        message: 'Enter name of the repo',
        name: 'repoNameInput',
        validate: input => {
          if (!input.trim().length) return ansi.red('Repo name is required');
          return true;
        },
        ...INQUIRER_DEFAULT_OPTS,
      },
    ]);
    config.repoName = repoNameInput;
    const repoAbsPath = join(process.cwd(), config.repoName);

    // STEP 3 - ask user their authorName only if not already defined in .rc file
    if (!config.authorName?.trim().length) {
      const { authorNameInput } = await inquirer.prompt({
        type: 'input',
        message: 'Enter author name',
        name: 'authorNameInput',
        validate: input => {
          if (!input.trim().length) return ansi.red('Author name is required');
          return true;
        },
        ...INQUIRER_DEFAULT_OPTS,
      });
      config.authorName = authorNameInput;
    }

    // STEP 4 - Download or Copy the template into chosen folder `repoName` in cwd
    const chosenTemplate = templates.find(t => t.name === inputTemplate);
    config.packageMap = []; // for tracking pkg manager locations
    config.hasHusky = false; // check if template has husky scripts
    if (isGithubPath) {
      console.log('\r');
      const spinner = createSpinner('Downloading files...\n').start();
      await downloadDirectory(chosenTemplate.url, config.repoName, config);
      spinner.success({ text: `${ansi.green('Project created!')}\n` });
    } else {
      console.log('\r');
      const spinner = createSpinner('Copying files...\n').start();
      await copyDirectory(chosenTemplate.path, config.repoName, config);
      spinner.success({ text: `${ansi.green('Project created!')}\n` });
    }

    // STEP 5 - initialize Git if specified in args already else start inquirer
    if (argv.git) {
      await initializeGit(repoAbsPath, config.hasHusky);
    } else {
      const { isGitRepoInput } = await inquirer.prompt({
        type: 'confirm',
        message: 'Initialize a git repository?',
        name: 'isGitRepoInput',
        default: true,
        ...INQUIRER_DEFAULT_OPTS,
      });
      if (isGitRepoInput) await initializeGit(repoAbsPath, config.hasHusky);
    }

    // STEP 6 - check if repo governed by pkgManager
    if (config.packageMap.length) {
      async function runPackageInstaller() {
        let message;
        if (config.packageMap.length > 1) {
          message = `Monorepo detected, installing packages in the paths:\n`;
          config.packageMap.forEach(p => {
            const pathSegs = p.path.split(sep);
            message += `${ansi.cyan(`[${p.manager}]`)} ${sep}${pathSegs[pathSegs.length - 2]}${sep}${pathSegs[pathSegs.length - 1]}\n`;
          });
        } else {
          message = `Detected ${ansi.cyan(config.packageMap[0].manager)}, installing packages...\n`;
        }
        if (!argv.git || !argv.install) console.log('\r');
        const spinner = createSpinner(message).start();
        const handles = config.packageMap.map(async p => {
          await installPackagesByPath(p.manager, p.path);
        });
        // run package installation parallely
        await Promise.all(handles);
        spinner.success({ text: `${ansi.green('Packages installed and ready!')}\n` });
      }

      // install packages if specified in args already else start inquirer
      if (argv.install) {
        await runPackageInstaller();
      } else {
        const { isPkgInstallInput } = await inquirer.prompt({
          type: 'confirm',
          message: 'Install Packages?',
          name: 'isPkgInstallInput',
          default: true,
          ...INQUIRER_DEFAULT_OPTS,
        });
        if (isPkgInstallInput) await runPackageInstaller();
      }
    }

    // STEP 7 - open generated repository in the code editor
    if (argv.editor?.length) {
      await openInEditor(argv.editor, repoAbsPath);
    } else {
      const { isOpenEditorInput } = await inquirer.prompt({
        type: 'confirm',
        message: 'Open in code editor?',
        name: 'isOpenEditorInput',
        default: true,
        ...INQUIRER_DEFAULT_OPTS,
      });
      if (isOpenEditorInput) await openInEditor(config.editorBinary, repoAbsPath);
    }

    process.exit(0);
  } catch (err) {
    console.log(ansi.red(`\n${err.message}`));
    process.exit(1);
  }
})();
