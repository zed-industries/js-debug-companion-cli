/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {
  ChromeBrowserFinder,
  EdgeBrowserFinder,
  FirefoxBrowserFinder,
  IBrowserFinder,
  isQuality,
} from '@vscode/js-debug-browsers';
import { spawn } from 'child_process';
import execa from 'execa';
import { promises as fs } from 'fs';
import { join } from 'path';
import { UserError } from './errors';
import { ILaunchParams } from './cli';
import { exists } from './fs';
import { PipedTarget, ServerTarget } from './target';

const debugPortPrefix = '--remote-debugging-port=';
const debugPipeArg = '--remote-debugging-port=';

export class BrowserSpawner {
  private readonly finders = {
    edge: new EdgeBrowserFinder(process.env, fs, execa),
    chrome: new ChromeBrowserFinder(process.env, fs, execa),
    firefox: new FirefoxBrowserFinder(process.env, fs, execa),
  };

  constructor(private readonly storagePath: string) {}

  private async findBrowserPath(type: 'edge' | 'chrome' | 'firefox', runtimeExecutable: string) {
    if (runtimeExecutable !== '*' && !isQuality(runtimeExecutable)) {
      return runtimeExecutable;
    }

    if (!(type in this.finders)) {
      throw new UserError(`Browser type "${type}" is not supported.`);
    }

    const available = await this.finders[type].findAll();

    const resolved =
      runtimeExecutable === '*'
        ? available.find(r => r.quality === 'stable') ?? available[0]
        : available.find(r => r.quality === runtimeExecutable);

    if (!resolved) {
      if (runtimeExecutable === /* Quality.Stable */ 'stable' && !available.length) {
        throw new UserError(
          `Unable to find a ${type} installation on your system. Try installing it, or providing an absolute path to the browser in the "runtimeExecutable" in your launch.json.`,
        );
      } else {
        throw new UserError(
          `Unable to find ${type} version ${runtimeExecutable}. Available auto-discovered versions are: ${JSON.stringify([...new Set(available)])}. You can set the "runtimeExecutable" in your launch.json to one of these, or provide an absolute path to the browser executable.`,
        );
      }
    }

    return resolved.path;
  }

  protected async findBrowserByExe(
    finder: IBrowserFinder,
    executablePath: string,
  ): Promise<string | undefined> {
    if (executablePath === '*') {
      // try to find the stable browser, but if that fails just get any browser
      // that's available on the system
      const found =
        (await finder.findWhere(r => r.quality === /* Quality.Stable */ 'stable')) ||
        (await finder.findAll())[0];
      return found?.path;
    } else if (isQuality(executablePath)) {
      return (await finder.findWhere(r => r.quality === executablePath))?.path;
    } else {
      return executablePath;
    }
  }

  private async getUserDataDir(params: ILaunchParams) {
    const requested = params.params.userDataDir;
    if (requested === false) {
      return;
    }

    const defaultDir = join(
      this.storagePath,
      params.browserArgs?.includes('--headless') ? '.headless-profile' : '.profile',
    );

    if (requested === true) {
      return defaultDir;
    }

    if (!(await exists(requested))) {
      return defaultDir;
    }

    return requested;
  }

  /**
   * Launches a browser using a specific browser type and url.
   */
  public async launchBrowserOnly(type: 'edge' | 'chrome' | 'firefox', url: string) {
    const binary = await this.findBrowserPath(type, '*');
    spawn(binary, [url], {
      detached: true,
      stdio: 'ignore',
    }).on('error', err => {
      console.error(`Error running browser: ${err.message || err.stack}`);
    });
  }

  /**
   * Launches and returns a child process for the browser specified by the
   * given parameters.
   * @throws UserError if the launch fails
   */
  public async launch(params: ILaunchParams) {
    const binary = await this.findBrowserPath(params.type, params.params.runtimeExecutable);

    const args = params.browserArgs.slice();
    const userDataDir = await this.getUserDataDir(params);
    // prepend args to not interfere with any positional arguments (e.g. url to open)
    if (userDataDir !== undefined) {
      args.unshift(`--user-data-dir=${userDataDir}`);
    }

    // The cwd defaults to the working directory of the remote extension, but
    // this probably won't exist on the local host. If it doesn't just set it
    // to the process' cwd.
    let cwd = params.params.cwd || params.params.webRoot;
    if (!cwd || !(await exists(cwd))) {
      cwd = process.cwd();
    }

    const port = args.find(a => a.startsWith(debugPortPrefix))?.slice(debugPortPrefix.length);
    if (!port) {
      return new PipedTarget(
        spawn(binary, args, {
          detached: process.platform !== 'win32',
          env: {
            ...process.env,
            GDK_PIXBUF_MODULEDIR: undefined,
            GDK_PIXBUF_MODULE_FILE: undefined,
            ELECTRON_RUN_AS_NODE: undefined,
            ...params.params.env,
          },
          stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'],
          cwd,
        }),
      );
    }

    if (!args.includes(debugPipeArg)) {
      // back compat with older js-debug versions
      args.unshift(debugPipeArg);
    }

    const child = spawn(binary, args, {
      detached: process.platform !== 'win32',
      env: { ELECTRON_RUN_AS_NODE: undefined, ...params.params.env },
      stdio: 'ignore',
      cwd,
    });

    return await ServerTarget.create(child, Number(port));
  }
}
