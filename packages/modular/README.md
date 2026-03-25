# @carpentry/modular

Laravel-style module loader for Carpenter applications.

This package gives you a nwidart/laravel-modules-like experience for TypeScript Carpenter apps, while keeping modules integrated with the main application container lifecycle.

## Supported Module Layout

```text
Modules/
  Blog/
    module.json
    module.ts
    Providers/
    Routes/
    Http/
    Database/
      Migrations/
      Seeders/
      Factories/
    resources/
      views/
      assets/
      lang/
    tests/
```

## module.json

```json
{
  "name": "Blog",
  "description": "Blog module",
  "enabled": true,
  "priority": 10,
  "entry": "module.js"
}
```

## module.ts / module.js

```ts
import type { CarpenterModuleDefinition } from '@carpentry/modular';

const BlogModule: CarpenterModuleDefinition = {
  name: 'Blog',
  providers: [BlogServiceProvider],
  register(app) {
    // register routes, bindings, etc.
  },
  async boot(app) {
    // runtime boot hooks
  },
};

export default BlogModule;
```

## Usage in Carpenter

```ts
import { bootstrap } from '@carpentry/carpenter';

const app = await bootstrap({
  appKey: 'base64:xxx',
  appEnv: 'local',
  appDebug: true,
  modules: {
    modulesRoot: './Modules'
  }
});
```

By default, module auto-discovery is enabled. Set `modules.enabled = false` to disable it.

## Direct Usage

```ts
import { CarpenterModuleManager } from '@carpentry/modular';

const moduleManager = new CarpenterModuleManager({ modulesRoot: './Modules' });
const discovered = await moduleManager.discover();
await moduleManager.registerAll(app, discovered);
```

Or with the factory:

```ts
import { createModuleManager } from '@carpentry/modular';

const moduleManager = createModuleManager({ modulesRoot: './Modules' });
```
