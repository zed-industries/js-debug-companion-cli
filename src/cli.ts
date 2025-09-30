/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

/**
 * Info about the WSL distro, if any. A common issue across scenarios is WSL
 * ports randomly not getting forwarded. Instead, in WSL, we can try to make
 * a connection via stdin/stdout on the nested WSL instance.
 */
export interface IWslInfo {
  execPath: string;
  distro: string;
  user: string;
}

export interface ILaunchParams {
  type: 'chrome' | 'edge';
  path: string;
  proxyUri: string;
  launchId: number;
  browserArgs: string[];
  wslInfo?: IWslInfo;
  attach?: {
    host: string;
    port: number;
  };
  // See IChromiumLaunchConfiguration in js-debug for the full type, a subset of props are here:
  params: {
    env: Readonly<{ [key: string]: string | null }>;
    runtimeExecutable: string;
    userDataDir: boolean | string;
    cwd: string | null;
    webRoot: string | null;
  };
}

import * as http from 'http';
import { SessionManager } from './sessionManager';
import { BrowserSpawner } from './spawn';

function parseArgs(): { listen?: string; state?: string } {
  const args: { [key: string]: string } = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  if (!args.listen || !args.state) {
    console.error('Usage: cli.ts --listen=ADDR --state=DIR');
    console.error('  ADDR: TCP address to listen on (e.g., localhost:3000 or 127.0.0.1:3000)');
    console.error('  DIR: Absolute path for state directory');
    process.exit(1);
  }

  const [host, portStr] = args.listen.split(':');
  const port = parseInt(portStr, 10);

  if (!host || !port || isNaN(port)) {
    console.error('Invalid listen address. Use format host:port (e.g., localhost:3000)');
    process.exit(1);
  }

  const browserSpawner = new BrowserSpawner(args.state);
  const manager = new SessionManager(browserSpawner);

  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        if (req.url === '/launch-and-attach') {
          const params: ILaunchParams = JSON.parse(body);
          await manager.create(params);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else if (req.url === '/kill') {
          const { launchId } = JSON.parse(body);
          manager.destroy(launchId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      } catch (error) {
        console.error('Request error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`JS Debug Companion CLI listening on ${host}:${port}`);
    console.log(`State directory: ${args.state}`);
    console.log('Endpoints:');
    console.log('  GET /launch-and-attach - Launch browser and attach debugger');
    console.log('  GET /kill - Kill a debug session');
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    manager.dispose();
    server.close(() => {
      process.exit(0);
    });
  });
}

// Only run main if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
