import os from 'os';
import fs from 'fs-extra';
import { resolve, join, sep } from 'pathe';
import ansi from 'ansi-colors';
import fetch from 'node-fetch';
import minimatch from 'minimatch';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import { escapeRegex } from './utils';
import { GITHUB_DIR_TYPE, GITHUB_FILE_TYPE, CONFIG_FILE_NAME, GITHUB_PATH_REGEX, INQUIRER_DEFAULT_OPTS } from './constants';

(async function () {
  let config;
  try {
    const homeDir = os.homedir();
    config = (await import(join(homeDir, CONFIG_FILE_NAME))).default;
  } catch {
    console.log(ansi.red(`\nConfig file ${ansi.bold(CONFIG_FILE_NAME)} missing in home directory`));
    process.exit(1);
  }

  if (!config.templatePath) {
    console.log(ansi.red(`\n${ansi.bold('templatePath')} missing in config file ${CONFIG_FILE_NAME}`));
    process.exit(1);
  }

  // register inquirer fuzzy search plugin
  inquirer.registerPrompt('search-list', (await import('inquirer-search-list')).default);

  const { templatePath, githubToken, authorName: defaultAuthor, slotPaths = [], customSlots = {} } = config;
  let authorName = defaultAuthor;
  let repoName;

  async function downloadDirectory(url, targetDir) {
    // create a folder if not exists
    await fs.ensureDir(targetDir);
    targetDir = resolve(targetDir);

    const contents = await callGitHubApi(githubToken, url);

    for (const content of contents) {
      if (content.type === GITHUB_FILE_TYPE) {
        const fileStr = await callGitHubApi(githubToken, content.url, true);
        const filePathAbs = join(targetDir, content.name);
        // replace slots in the file and write it
        fs.writeFile(filePathAbs, replaceSlots(filePathAbs, fileStr));
      } else if (content.type === GITHUB_DIR_TYPE) {
        await downloadDirectory(content.url, join(targetDir, content.name));
      } else {
        console.log(ansi.red(`\n Unknown type for ${ansi.bold(content.name)}`));
      }
    }
  }

  async function copyDirectory(path, targetDir) {
    // create a folder if not exists
    await fs.ensureDir(targetDir);
    targetDir = resolve(targetDir);

    const contents = await fs.readdir(path);

    for (const content of contents) {
      const contentAbsPath = path + sep + content;
      if (fs.lstatSync(contentAbsPath).isFile()) {
        const fileStr = await fs.readFile(contentAbsPath, 'utf8');
        const filePathAbs = join(targetDir, content);
        // replace slots in the file and write it
        fs.writeFile(filePathAbs, replaceSlots(filePathAbs, fileStr));
      } else if (fs.lstatSync(contentAbsPath).isDirectory()) {
        await copyDirectory(contentAbsPath, join(targetDir, content));
      } else {
        console.log(ansi.red(`\n Unknown type for ${ansi.bold(content)}`));
      }
    }
  }

  function replaceSlots(filePath, content) {
    if (slotPaths.some(pattern => minimatch(filePath, pattern))) {
      const slots = {
        '[REPO_NAME]': repoName.trim(),
        '[AUTHOR_NAME]': authorName.trim(),
        ...customSlots,
      };
      const regex = new RegExp(escapeRegex(Object.keys(slots).join('|')), 'g');
      return content.replace(regex, match => slots[match]);
    }
    return content;
  }

  try {
    // check if template path is a github url or local folder
    const isGithubPath = GITHUB_PATH_REGEX.test(templatePath);

    let templates;
    if (isGithubPath) {
      const spinner = createSpinner('Fetching templates from GitHub...').start();
      templates = await callGitHubApi(githubToken, templatePath);
      spinner.success({ text: 'Templates Fetched!\n' });
    } else {
      const spinner = createSpinner('Searching templates...\n').start();
      templates = await getLocalTemplates(templatePath);
      spinner.success({ text: `Templates located at ${ansi.cyan(templatePath)}\n` });
    }

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

    repoName = repoNameInput;

    if (!authorName?.trim().length) {
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
      authorName = authorNameInput;
    }

    const chosenTemplate = templates.find(t => t.name === inputTemplate);
    if (isGithubPath) {
      console.log('\r');
      const spinner = createSpinner('Downloading files...\n').start();
      await downloadDirectory(chosenTemplate.url, repoName);
      spinner.success({ text: `${ansi.green('Project created!')}\n` });
    } else {
      console.log('\r');
      const spinner = createSpinner('Copying files...\n').start();
      await copyDirectory(chosenTemplate.path, repoName);
      spinner.success({ text: `${ansi.green('Project created!')}\n` });
    }

    // const { isGitRepo } = await inquirer.prompt({
    //   type: 'confirm',
    //   message: 'Initialize a git repository?',
    //   name: 'isGitRepo',
    //   default: false,
    //   // default: true, // TODO: Check if possible to get from args
    //   ...INQUIRER_DEFAULT_OPTS,
    // });

    process.exit(0);
  } catch (err) {
    console.log(ansi.red(`\n${err.message}`));
    process.exit(1);
  }
})();

async function getLocalTemplates(templatePath) {
  const filesAndDirs = await fs.readdir(templatePath);
  return filesAndDirs
    .filter(fd => fs.lstatSync(templatePath + sep + fd).isDirectory())
    .map(t => ({ name: t, path: templatePath + sep + t }));
}

async function callGitHubApi(token, url, raw = false) {
  const headers = { accept: `application/vnd.github.${raw ? 'raw' : 'json'}` };
  if (token) headers.Authorization = `token ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Error calling GitHub API - ${response.statusText} | ${response.url}`);

  if (raw) return await response.text();
  return await response.json();
}
