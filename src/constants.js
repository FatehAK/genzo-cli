import ansi from 'ansi-colors';

export const GITHUB_DIR_TYPE = 'dir';
export const GITHUB_FILE_TYPE = 'file';
export const CONFIG_FILE_NAME = '.uprc.js';
export const GITHUB_PATH_REGEX = /^(https?:\/\/)?(api\.github\.com\/repos\/)([\w-].*)+\/?$/;
export const INQUIRER_DEFAULT_OPTS = {
  prefix: ansi.green('?'),
  suffix: ansi.yellow(' ➞'),
};
