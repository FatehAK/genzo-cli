import os from 'os';
import { join } from 'pathe';
import ansi from 'ansi-colors';
import minimist from 'minimist';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { downloadDirectory, callGitHubApi, copyDirectory, getLocalTemplates, initializeGit } from './utils';
import { CONFIG_FILE_NAME, GITHUB_PATH_REGEX, INQUIRER_DEFAULT_OPTS } from './constants';

(async function () {
  // get cli arguments
  const argv = minimist(process.argv.slice(2), {
    alias: {
      help: 'h',
      version: 'v',
      git: 'g',
      install: 'i',
    },
  });

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
      const spinner = createSpinner('Fetching templates from GitHub...').start();
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
    let hasGitArg = argv.git;
    if (!hasGitArg) {
      const { isGitRepoInput } = await inquirer.prompt({
        type: 'confirm',
        message: 'Initialize a git repository?',
        name: 'isGitRepoInput',
        default: false,
        ...INQUIRER_DEFAULT_OPTS,
      });
      hasGitArg = isGitRepoInput;
    }
    if (hasGitArg) await initializeGit(join(process.cwd(), config.repoName));

    process.exit(0);
  } catch (err) {
    console.log(ansi.red(`\n${err.message}`));
    process.exit(1);
  }
})();
