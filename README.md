# Koa Middleware Test Utils

[![NPM Version](https://img.shields.io/npm/v/koa-mock-ctx.svg)](https://www.npmjs.com/package/koa-mock-ctx)
[![CI](https://github.com/ben-walters/koa-mock-ctx/actions/workflows/release.yaml/badge.svg)](https://github.com/ben-walters/koa-mock-ctx/actions)
[![codecov](https://codecov.io/gh/ben-walters/koa-mock-ctx/graph/badge.svg)](https://codecov.io/gh/ben-walters/koa-mock-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight utility for testing Koa middleware in complete isolation. This toolkit allows you to craft precise, fast, and reliable unit tests for your middleware without needing to run a live server.

It provides a powerful factory to create mock Koa `Context` objects, integrates seamlessly with Jest, and includes a standard `compose` function to test middleware chains.

## Features

- **Type-Safe Testing Engine**: Define types for your setup, providing a first-class TypeScript experience.
- **Test Isolation by Design**: The factory pattern ensures every test runs in a pristine, isolated context.
- **Realistic Mocking**: Accurately mocks Koa's context, request, and response objects and methods.
- **Built-in Body Parser Simulation**: Easily test middleware that requires a parsed request body or files.
- **Jest Integration**: The mocked `next` function is a `jest.Mock` instance, ready for assertions.
- **Zero Dependencies**: Other than Koa itself.

## Installation

```bash
npm install --save-dev koa-mock-ctx
```

```bash
yarn add --dev koa-mock-ctx
```

## Usage

This library is designed to scale with your testing needs, from the simplest middleware to complex, type-augmented contexts.

### Pattern 1: The Basics

For simple middleware, you can import and use `mockContext` directly. It's a ready-to-use generator for basic test cases.

**Middleware (`src/middleware/set-header.ts`):**

```typescript
import * as Koa from 'koa';

export const setApiHeader = async (ctx: Koa.Context, next: Koa.Next) => {
  ctx.set('X-API-Version', 'v2');
  await next();
};
```

**Test (`__tests__/set-header.test.ts`):**

```typescript
import { setApiHeader } from '../src/middleware/set-header';
import { mockContext } from 'koa-mock-ctx';

describe('setApiHeader Middleware', () => {
  it('should set the X-API-Version header', async () => {
    // Arrange: Create a basic context.
    const [ctx, next] = mockContext();

    // Act: Run the middleware.
    await setApiHeader(ctx, next);

    // Assert: Check the response header and that next was called.
    expect(ctx.response.get('X-API-Version')).toBe('v2');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
```

### Pattern 2: Type-Safe Body Parsing (Recommended)

For real-world applications, you'll need to test middleware that reads the request body. The recommended approach is to create a pre-configured, type-safe "engine" for your test suite.

**Step 1: Create a Typed Engine**

In a shared test helper file, create an engine that simulates the presence of a body-parser.

**`__tests__/helpers.ts`**

```typescript
import { createKoaMockCtx } from 'koa-mock-ctx';

// Create an engine that simulates a body-parser being present.
// The returned `testCtxEngine` is now permanently type-safe for this setup.
export const testCtxEngine = createKoaMockCtx({
  bodyParser: true,
});
```

**Step 2: Use Your Engine in Tests**

Import your custom engine. Its `.create()` method will generate perfectly typed contexts where `ctx.request.body` is available.

**`__tests__/process-user.test.ts`**

```typescript
import { testCtxEngine } from './helpers';
import { processUser } from '../src/middleware/process-user'; // Your middleware

describe('processUser Middleware', () => {
  it('should greet the user when a name is provided', async () => {
    // Arrange: Use the engine to create a context with a request body.
    const [ctx] = testCtxEngine.create({
      requestBody: { name: 'Alice' },
    });

    // Act: Run the middleware.
    await processUser(ctx);

    // Assert: The context is typed correctly, and the test is clean.
    expect(ctx.body).toEqual({ message: `Hello, Alice` });
  });
});
```

---

## Troubleshooting

### Argument of type 'MockKoaContext' is not assignable to parameter of type (1)

_PROBLEM_ - You run into an invalid type signature along the lines of:

```

const [ctx, next] = mockContext();

await myMiddleware(ctx, next);  // ERROR

// Property 'body' is optional in type 'MockKoaRequest' but required in type 'Request'.
```

_SOLUTION_ - You are using the basic "out-the-box" Koa context, without `@koa/bodyparser`. Create a factory which flags `bodyParser: true` and use that to create you ctx. This can be done via a helper and imported throughout your tests:

```
// Add this
const ctxFactory = createKoaMockCtx({
    bodyParser: true,
});

// Use like this
const [ctx, next] = ctxFactory.create({
            requestBody: {
                body: 'message body',
            },
        });
await updateClientNoteValidation(ctx, next); // FIXED!

```

---

## API Reference

### `createKoaMockCtx(engineOptions?, baseOptions?)`

The main factory function for creating a type-safe mock context engine.

- `engineOptions?: KoaMockCtxOptions`: Configuration for the engine's behavior and types.
  - `bodyParser: boolean`: If `true`, the engine will produce contexts where `request.body` and `request.files` are available, simulating a body-parser. Defaults to `false`.
- `baseOptions?: MockContextOptions`: Default values (e.g., a base `state` object) to apply to every context created by this engine.

Returns an engine object with a single method:

- `.create(overrideOptions?: MockContextOptions)`: Creates a new, isolated `[ctx, next]` tuple.

### `mockContext(options?: MockContextOptions)`

A default, ready-to-use generator for simple test cases where no special types are needed. It is a shortcut for `createKoaMockCtx().create`.

### `compose(middleware: Koa.Middleware[])`

A standard Koa middleware composer for testing a chain of middleware.

### `MockContextOptions`

The options object for creating a context.

| Property         | Type                                     | Description                                                 | Default      |
| :--------------- | :--------------------------------------- | :---------------------------------------------------------- | :----------- |
| `state`          | `Record<string, any>`                    | The initial `ctx.state` object.                             | `{}`         |
| `requestHeaders` | `Record<string, string \| string[]>`     | **Request headers**. Populates `ctx.headers`.               | `{}`         |
| `method`         | `string`                                 | The request method.                                         | `'GET'`      |
| `url`            | `string`                                 | The request URL.                                            | `'/'`        |
| `requestBody`    | `unknown`                                | The initial **request body**. Populates `ctx.request.body`. | `undefined`  |
| `files`          | `Record<string, MockFile \| MockFile[]>` | Mock files for multipart requests.                          | `undefined`  |
| `cookies`        | `Record<string, string>`                 | Initial cookies available via `ctx.cookies.get()`.          | `{}`         |
| `host`           | `string`                                 | The request host.                                           | `'test.com'` |
| `...`            | `any`                                    | Any other properties are attached directly to the `ctx`.    |              |

### Context Helper Methods

The mock context object (`ctx`) includes several convenience methods to simulate the work of upstream middleware or to simplify test setup.

- `ctx.setBody(body: unknown)`: Sets the **request** body. A shortcut for `ctx.request.body = body;`.
- `ctx.setHeaders(headers: Record<string, ...>)`: Sets multiple **request** headers at once.
- `ctx.setCookies(cookies: Record<string, string>)`: Sets multiple cookies at once.

**Example:**

```typescript
import { mockContext } from 'koa-mock-ctx';

it('should use the helper methods for setup', async () => {
  // Arrange: Create a blank context
  const [ctx, next] = mockContext();

  // Arrange: Use helpers to simulate the state left by upstream middleware
  ctx.setHeaders({ 'x-api-key': '12345' });
  ctx.setCookies({ session: 'abc-xyz' });
  ctx.setBody({ name: 'test-user' });

  // Act
  await yourMiddleware(ctx, next);

  // Assert
  expect(ctx.get('x-api-key')).toBe('12345');
  expect(ctx.cookies.get('session')).toBe('abc-xyz');
  expect(ctx.request.body).toEqual({ name: 'test-user' });
});
```

### Included Helpers

For convenience, `http-assert` and `http-errors` are re-exported.

```typescript
import { httpAssert, HttpErrors } from 'koa-mock-ctx';
```

## Contributing

If you have suggestions for how this project could be improved, or want to report a bug, open an issue! I'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2025 Ben Walters
