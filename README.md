## TypeScript service plugin: Union type documentation

Show JS/TS doc comments from union type entries in quick info.

### Planned Features

- Show union entry ts doc comment for:
  - union function parameter below normal quickinfo
  - const with union type

### Get Started

### How to debug

Start example project with tsserver debug command:

```bash
TSS_DEBUG=5667 code ./example --user-data-dir ~/.vscode-debug/
```

This project has a `debugger` statement inside the completions which will trigger on completions, you can get that running and then you have proven the toolset works and get started building your plugin.

You can read up the docs on [Language Service Plugins in the TypeScript repo wiki](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#overview-writing-a-simple-plugin).
