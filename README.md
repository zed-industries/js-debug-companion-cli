# js-debug-companion-cli

This is a fork of the original [vscode-js-debug-companion](https://github.com/microsoft/vscode-js-debug-companion) project, which allows running the same code as a standalone process instead of a VS Code extension. It's used by [Zed](https://zed.dev) to support browser debugging in SSH and WSL projects.

The CLI is launched as follows:

```bash
node out/cli.js --listen=localhost:3000 --state=/path/to/state/dir
```

This launches a process that will listen for HTTP requests on the specified address. There are two endpoints:

- `POST /launch-and-attach`: Corresponds to the VS Code `js-debug-companion.launchAndAttach` command.
- `POST /kill`: Corresponds to the VS Code `js-debug-companion.kill` command.

The body for each request should be the same JSON payload that's provided to the corresponding command by vscode-js-debug. The process can handle launching and killing multiple browsers during its lifetime.

## Original vscode-js-debug-companion README

A companion extension to [js-debug](https://github.com/microsoft/vscode-js-debug) to enable remote Chrome debugging. You probably don't want to install this extension by itself, but for your interest, this is what it does.

The scenario is if you are developing in a remote environment—like WSL, a container, ssh, or [VS Codespaces](https://visualstudio.microsoft.com/services/visual-studio-codespaces/)—and are port-forwarding a server to develop (and debug) in a browser locally. For remote development, VS Code runs two sets of extensions: one on the remote machine, and one on your local computer. `js-debug` is a "workspace" extension that runs on the remote machine, but we need to launch and talk to Chrome locally.

That's where this companion extension comes in. This helper extension runs on the local machine (in the "UI") and registers a command that `js-debug` can call to launch a server. `js-debug` requests a port to be forwarded for debug traffic, and once launching a browser the companion will connect to and forward traffic over that socket.
