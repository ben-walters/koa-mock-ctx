# Koa Middleware Test Utils

[![NPM Version](https://img.shields.io/npm/v/koa-mock-ctx.svg)](https://www.npmjs.com/package/koa-mock-ctx)
[![CI](https://github.com/ben-walters/koa-mock-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/ben-walters/koa-mock-ctx/actions)
[![codecov](https://codecov.io/gh/ben-walters/koa-mock-ctx/graph/badge.svg)](https://codecov.io/gh/ben-walters/koa-mock-ctx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A lightweight utility for testing Koa middleware in complete isolation. This toolkit allows you to craft precise, fast, and reliable unit tests for your middleware without needing to run a live server.

It provides a single, powerful function to create mock Koa `Context` objects, integrates seamlessly with Jest, and includes a standard `compose` function to test middleware chains.

## Features

- **Unified API**: A single function for both simple contexts and reusable factories.
- **Type-Safe**: Written in TypeScript to provide excellent autocompletion.
- **Realistic Mocking**: Accurately mocks Koa's context, request, and response.
- **Jest Integration**: The mocked `next` function is a `jest.Mock` instance.
- **Zero Dependencies**: Other than Koa itself.

## Installation

```bash
npm install --save-dev koa-mock-ctx
```

```bash
yarn add --dev koa-mock-ctx
```

## Quick Start

This library exports a single main function, `mockContext`, which can be used in two ways.

### 1. For Simple Tests: Call `mockContext` Directly

When you need a basic, one-off context for a test, simply call `mockContext` with any options you need.

**Middleware (`src/middleware/add-user.ts`):**

```typescript
import * as Koa from 'koa';

export const addUser = async (ctx: Koa.Context, next: Koa.Next) => {
  const userId = ctx.get('x-user-id');
  if (userId) {
    // In a real app, you'd look this up in a database
    ctx.state.user = { id: userId, name: 'Test User' };
  }
  await next();
};
```

**Test (`__tests__/add-user.test.ts`):**

```typescript
import { addUser } from '../src/middleware/add-user';
import { mockContext } from 'koa-mock-ctx';

describe('addUser Middleware', () => {
  it('should add user to state if header is present', async () => {
    // Arrange: Create a context with the required header
    const [ctx, next] = mockContext({
      headers: { 'x-user-id': 'user-42' },
    });

    // Act: Run the middleware
    await addUser(ctx, next);

    // Assert: Check the context and that next was called
    expect(ctx.state.user).toEqual({ id: 'user-42', name: 'Test User' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
```

### 2. For Reusable Setups: Use `mockContext.factory()`

To keep your tests DRY (Don't Repeat Yourself), use the `.factory()` method to create a reusable generator for a common setup (like an authenticated user).

**Test (`__tests__/protected-routes.test.ts`):**

```typescript
import { someAdminMiddleware } from '../src/middleware/admin';
import { mockContext } from 'koa-mock-ctx';

// Arrange: Create a factory for an authenticated admin user.
const adminContextFactory = mockContext.factory({
  state: {
    user: { id: 'admin-1', role: 'admin' },
  },
});

describe('someAdminMiddleware', () => {
  it('should allow access for an admin user', async () => {
    const [ctx, next] = adminContextFactory();
    await someAdminMiddleware(ctx, next);
    expect(ctx.status).not.toBe(403);
    expect(next).toHaveBeenCalled();
  });
});
```

## API Reference

### `mockContext(options?: MockContextOptions)`

The main function. Call it directly to get a mock context tuple `[ctx, next]` for a simple test.

### `mockContext.factory(baseOptions?: MockContextOptions)`

Creates a **factory function** for generating mock contexts with a shared base configuration. The returned factory can then be called with `overrideOptions` for specific tests.

### `compose(middleware: Koa.Middleware[])`

A standard Koa middleware composer. It takes an array of middleware and returns a single function that will execute them in sequence.

### `MockContextOptions`

The options object for `mockContext` or `mockContext.factory`.

| Property  | Type                                 | Description                                                          | Default      |
| :-------- | :----------------------------------- | :------------------------------------------------------------------- | :----------- |
| `state`   | `Record<string, any>`                | The initial `ctx.state` object.                                      | `{}`         |
| `headers` | `Record<string, string \| string[]>` | **Request headers**. Used to populate `ctx.headers` and `ctx.get()`. | `{}`         |
| `method`  | `string`                             | The request method.                                                  | `'GET'`      |
| `url`     | `string`                             | The request URL.                                                     | `'/'`        |
| `body`    | `unknown`                            | The initial **response body**.                                       | `null`       |
| `status`  | `number`                             | The initial **response status**.                                     | `200`        |
| `cookies` | `Record<string, string>`             | Initial cookies available via `ctx.cookies.get()`.                   | `{}`         |
| `host`    | `string`                             | The request host.                                                    | `'test.com'` |

### The Mock Context Object (`MockKoaContext`)

The returned `ctx` object realistically mimics the real Koa `Context`, including properties like `ctx.body`, `ctx.status`, `ctx.get()`, and `ctx.throw()`.

For convenience, it also includes three special helper methods to make your tests cleaner:

- `setBody(body: unknown)`: A shortcut for `ctx.body = body;`.
- `setHeaders(headers: Record<string, string | string[]>)`: Sets multiple **request** headers at once.
- `setCookies(cookies: Record<string, string>)`: Sets multiple cookies at once.

**Example:**

```typescript
import { mockContext } from 'koa-mock-ctx';

it('should use the helper methods', () => {
  const [ctx, next] = mockContext();

  ctx.setHeaders({ 'x-api-key': '12345' });
  ctx.setCookies({ session: 'abc-xyz' });
  ctx.setBody({ message: 'Success' });

  await yourMiddleware(ctx, next);

  expect(next).toHaveBeenCalled();
  expect(ctx.get('x-api-key')).toBe('12345');
  expect(ctx.cookies.get('session')).toBe('abc-xyz');
  expect(ctx.body).toEqual({ message: 'Success' });
});
```

### The Mock Next Function (`MockKoaNext`)

The returned `next` function is a `jest.Mock` instance (`jest.fn()`). This allows you to make assertions about whether the middleware chain continued.

```typescript
expect(next).toHaveBeenCalled();
expect(next).toHaveBeenCalledTimes(1);
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
