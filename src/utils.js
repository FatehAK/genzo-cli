import { resolve, join, sep } from 'pathe';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import { execa } from 'execa';
import minimatch from 'minimatch';
import ansi from 'ansi-colors';
import { GITHUB_DIR_TYPE, GITHUB_FILE_TYPE } from './constants';

export function escapeRegex(string) {
  return string.replace(/[.*+\-?^${}()[\]\\]/g, '\\$&');
}

export async function getLocalTemplates(templatePath) {
  const filesAndDirs = await fs.readdir(templatePath);
  return filesAndDirs
    .filter(fd => fs.lstatSync(templatePath + sep + fd).isDirectory())
    .map(t => ({ name: t, path: templatePath + sep + t }));
}

export async function callGitHubApi(url, token, raw = false) {
  const headers = { accept: `application/vnd.github.${raw ? 'raw' : 'json'}` };
  if (token) headers.Authorization = `token ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Error calling GitHub API - ${response.statusText} | ${response.url}`);

  if (raw) return await response.text();
  return await response.json();
}

function checkForPkgManager(filePath) {
  if (filePath.includes('package-lock.json')) return 'npm';
  if (filePath.includes('yarn.lock')) return 'yarn';
  if (filePath.includes('pnpm-lock.yaml')) return 'pnpm';
  return false;
}

function checkForHuskyScripts(filePath) {
  return filePath.includes('.husky');
}

export async function downloadDirectory(url, targetDir, config) {
  // create a folder if not exists
  await fs.ensureDir(targetDir);
  targetDir = resolve(targetDir);

  const contents = await callGitHubApi(url, config.githubToken);

  for (const content of contents) {
    if (content.type === GITHUB_FILE_TYPE) {
      const fileStr = await callGitHubApi(content.url, config.githubToken, true);
      const filePathAbs = join(targetDir, content.name);
      // check for pkg manager lock files
      const pkgManager = checkForPkgManager(filePathAbs);
      if (pkgManager) config.packageMap.push({ manager: pkgManager, path: targetDir });
      // check for husky scripts
      if (checkForHuskyScripts(filePathAbs)) config.hasHusky = true;
      // replace slots in the file and write it
      fs.writeFile(filePathAbs, replaceSlots(filePathAbs, fileStr, config));
    } else if (content.type === GITHUB_DIR_TYPE) {
      await downloadDirectory(content.url, join(targetDir, content.name), config);
    } else {
      console.log(ansi.red(`\n Unknown type for ${ansi.bold(content.name)}`));
    }
  }
}

export async function copyDirectory(path, targetDir, config) {
  // create a folder if not exists
  await fs.ensureDir(targetDir);
  targetDir = resolve(targetDir);

  const contents = await fs.readdir(path);

  for (const content of contents) {
    const contentAbsPath = path + sep + content;
    if (fs.lstatSync(contentAbsPath).isFile()) {
      const fileStr = await fs.readFile(contentAbsPath, 'utf8');
      const filePathAbs = join(targetDir, content);
      // check for pkg manager lock files
      const pkgManager = checkForPkgManager(filePathAbs);
      if (pkgManager) config.packageMap.push({ manager: pkgManager, path: targetDir });
      // check for husky scripts
      if (checkForHuskyScripts(filePathAbs)) config.hasHusky = true;
      // replace slots in the file and write it
      fs.writeFile(filePathAbs, replaceSlots(filePathAbs, fileStr, config));
    } else if (fs.lstatSync(contentAbsPath).isDirectory()) {
      await copyDirectory(contentAbsPath, join(targetDir, content), config);
    } else {
      console.log(ansi.red(`\n Unknown type for ${ansi.bold(content)}`));
    }
  }
}

function replaceSlots(filePath, content, config) {
  if (config.slotPaths?.some(pattern => minimatch(filePath, pattern))) {
    const { slots = {} } = config;
    const allSlots = {
      '[REPO_NAME]': config.repoName.trim(),
      '[AUTHOR_NAME]': config.authorName.trim(),
      ...slots,
    };
    const regex = new RegExp(escapeRegex(Object.keys(allSlots).join('|')), 'g');
    return content.replace(regex, match => allSlots[match]);
  }
  return content;
}

export async function initializeGit(targetDir, hasHusky) {
  const result = await execa('git', ['init'], { cwd: targetDir });
  if (result.failed) return Promise.reject(new Error('Failed to initialize git'));

  if (hasHusky) {
    // set husky scripts as executable
    const result = await execa('chmod', ['ug+x', `${targetDir}${sep}.husky${sep}*`], { shell: true });
    if (result.failed) return Promise.reject(new Error('Failed to initialize husky'));
  }

  return true;
}

export async function installPackagesByPath(pkgManager, targetDir) {
  const result = await execa(pkgManager, ['install'], { cwd: targetDir });
  if (result.failed) return Promise.reject(new Error('Failed to install packages'));
  return true;
}

export async function openInEditor(editor, targetDir) {
  const result = await execa(editor, [targetDir]);
  if (result.failed) return Promise.reject(new Error('Failed to open in code editor'));
  return true;
}

export function getHelpTemplate() {
  return `
NAME:
  gen - rapidly scaffold projects for development with custom templates

USAGE:
  gen [OPTIONS] | genzo [OPTIONS]

OPTIONS:
  -h, --help             show this message and exit
  -v, --version          print the version string
  -g, --git              auto-initialize a git repository
  -i, --install          auto-install packages
  -e, --editor <string>  open in the specified editor

EXAMPLES:
  gen -g                 # auto-initializes a git repository without querying the user
  gen -i                 # auto-installs packages without querying the user
  gen -e code            # opens the generated repository in the specified code editor (eg. VSCode)
  gen -gi -e code        # does all the tasks defined above in a single command

Author: <github.com/FatehAK>
`;
}
