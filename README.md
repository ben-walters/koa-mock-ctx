# Koa Middleware Test Utils

[![NPM Version](https://img.shields.io/npm/v/koa-mock-ctx.svg)](https://www.npmjs.com/package/koa-mock-ctx)
[![CI](https://github.com/ben-walters/koa-mock-ctx/actions/workflows/ci.yml/badge.svg)](https://github.com/ben-walters/koa-mock-ctx/actions)
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
// This can be shared across all tests in this file.
const adminContextFactory = mockContext.factory({
  state: {
    user: { id: 'admin-1', role: 'admin' },
  },
});

describe('someAdminMiddleware', () => {
  it('should allow access for an admin user', async () => {
    // Act: Get a pre-configured context from the factory
    const [ctx, next] = adminContextFactory();

    await someAdminMiddleware(ctx, next);

    expect(ctx.status).not.toBe(403);
    expect(next).toHaveBeenCalled();
  });

  it('should set a special header when the method is POST', async () => {
    // Act: Use the factory but override the method for this specific test
    const [ctx, next] = adminContextFactory({ method: 'POST' });

    await someAdminMiddleware(ctx, next);

    expect(ctx.response.headers['x-admin-action']).toBe('true');
  });
});
```

## API Reference

### `mockContext(options?: MockContextOptions)`

The main function. Call it directly to get a mock context tuple `[ctx, next]` for a simple test.

### `mockContext.factory(baseOptions?: MockContextOptions)`

Creates a **factory function** for generating mock contexts with a shared base configuration. The returned factory can then be called with `overrideOptions` for specific tests.

### `compose(middleware: Koa.Middleware[])`

A standard Koa middleware composer. It takes an array of middleware and returns a single function that will execute them in sequence. This is essential for testing the interaction between multiple middleware.

**Example:**

```typescript
import { mockContext, compose } from 'koa-mock-ctx';
// import your middleware...

it('should process the request through the full chain', async () => {
  const [ctx, finalNext] = mockContext();
  const middlewareChain = compose([
    authMiddleware,
    fetchDataMiddleware,
    loggerMiddleware,
  ]);

  await middlewareChain(ctx, finalNext);

  expect(ctx.state.data).toBeDefined();
  expect(ctx.body).toEqual({ result: 'some data' });
  expect(finalNext).toHaveBeenCalledTimes(1);
});
```

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

### `MockKoaContext` and `MockKoaNext`

- The returned `ctx` object is a `MockKoaContext`, which realistically mimics the real Koa `Context`.
- The returned `next` function is a `jest.Mock` instance (`jest.fn()`), allowing you to make assertions like `expect(next).toHaveBeenCalled()`.

### Included Helpers

For convenience, `http-assert` and `http-errors` are re-exported.

```typescript
import { httpAssert, HttpErrors } from 'koa-mock-ctx';
```
