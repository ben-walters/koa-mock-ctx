# Koa Middleware Test Utils

A lightweight, zero-dependency utility for testing Koa middleware in complete isolation. This toolkit allows you to craft precise, fast, and reliable unit tests for your middleware without needing to run a live server.

It provides a powerful factory for creating mock Koa `Context` objects, integrates seamlessly with Jest, and includes a standard `compose` function to test middleware chains.

## Features

- **Factory-Based Mocking**: Create "baked-in" context factories for common scenarios (e.g., authenticated users) and override them for specific tests.
- **Type-Safe**: Written in TypeScript to provide excellent autocompletion and type safety for your tests.
- **Minimal Dependencies**: Relies only on `koa` and `@types/koa` (and `jest` in your dev environment).
- **Realistic Mocking**: Accurately mocks Koa's context delegates (e.g., `ctx.body`, `ctx.status`, `ctx.get()`, `ctx.set()`).
- **Helper Functions**: Includes a `compose` function to test a full middleware chain.

## Installation

Install the package using npm or yarn:

```bash
npm install koa-mock-ctx
```

```bash
yarn add koa-mock-ctx
```

## API Reference

### `mockCtx(baseOptions?: MockContextOptions)`

This is the core factory function. It takes an optional `baseOptions` object and returns a _new function_ that you can use to generate mock contexts for your tests. This pattern is incredibly useful for reducing boilerplate in your test files.

```typescript
import { mockCtx } from './test-utils';

// Create a factory for tests that need an authenticated user
const authenticatedContext = mockCtx({
  state: { user: { id: 1, name: 'Admin' } },
  headers: { 'x-tenant-id': 'tenant-123' },
});

// Later in a test...
const [ctx, next] = authenticatedContext({ method: 'POST' });
```

### `mockContext(overrideOptions?: MockContextOptions)`

A pre-made, general-purpose context generator for simple, one-off tests. It is an instance of `mockCtx()` created with no base options.

```typescript
import { mockContext } from './test-utils';

it('should do something simple', () => {
  const [ctx, next] = mockContext({ method: 'DELETE' });
  // ... your test logic
});
```

### `compose(middleware: Koa.Middleware[])`

A standard Koa middleware composer. It takes an array of middleware and returns a single function that will execute them in sequence. This is essential for testing the interaction between multiple middleware.

### `MockContextOptions`

This is the interface for the options object you can pass to `mockCtx` or `mockContext`.

| Property         | Type                                 | Description                                                                     |
| :--------------- | :----------------------------------- | :------------------------------------------------------------------------------ |
| `state`          | `Record<string, any>`                | The initial `ctx.state` object.                                                 |
| `headers`        | `Record<string, string \| string[]>` | **Request headers**. Used to populate `ctx.headers` and `ctx.get()`.            |
| `method`         | `string`                             | The request method (e.g., `'GET'`, `'POST'`). Defaults to `'GET'`.              |
| `url`            | `string`                             | The request URL. Defaults to `'/'`.                                             |
| `body`           | `unknown`                            | The initial **response body**. Defaults to `null`.                              |
| `status`         | `number`                             | The initial **response status**. Defaults to `200`.                             |
| `cookies`        | `Record<string, string>`             | Initial cookies available via `ctx.cookies.get()`.                              |
| `host`           | `string`                             | The request host. Defaults to `'test.com'`.                                     |
| `protocol`       | `string`                             | The request protocol. Defaults to `'http'`.                                     |
| `app`            | `Partial<Koa>`                       | A partial mock of the Koa `app` instance.                                       |
| `requestHeaders` | `Record<string, string \| string[]>` | An alias for `headers`, kept for backward compatibility. Merged with `headers`. |

### `MockKoaContext`

The returned context object. It extends the real Koa `Context` and includes all the standard properties and methods you'd expect (`ctx.body`, `ctx.status`, `ctx.state`, `ctx.get()`, `ctx.set()`, `ctx.throw()`, etc.).

It also includes three special helper methods for cleaner tests:

- `setBody(body: unknown)`: A shortcut for `ctx.body = body;`.
- `setHeaders(headers: Record<string, string | string[]>)`: A shortcut for setting multiple request headers.
- `setCookies(cookies: Record<string, string>)`: A shortcut for setting multiple cookies.

### `MockKoaNext`

The returned `next` function is a `jest.Mock` instance (`jest.fn()`). You can use it to assert that the next middleware in a chain was (or was not) called.

```typescript
expect(next).toHaveBeenCalled();
expect(next).toHaveBeenCalledTimes(1);
```

### Included Helpers

For convenience, `http-assert` and `http-errors` are re-exported. You can import them directly from the utility file to use in your tests.

```typescript
import { httpAssert, HttpErrors } from './test-utils';
```

---

## How to Write Tests

### Example 1: Testing a Single Middleware

Let's say you have a simple middleware that adds user data to the context state.

**The Middleware (`src/middleware/add-user.ts`):**

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

**The Test (`__tests__/add-user.test.ts`):**

```typescript
import { addUser } from '../src/middleware/add-user';
import { mockContext } from '../src/test-utils';

describe('addUser Middleware', () => {
  it('should add a user to the state if x-user-id header is present', async () => {
    // Arrange: Create a context with the required header
    const [ctx, next] = mockContext({
      headers: { 'x-user-id': 'user-42' },
    });

    // Act: Run the middleware
    await addUser(ctx, next);

    // Assert: Check that the state was modified correctly
    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.user.id).toBe('user-42');
    // Assert that the middleware continued the chain
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should not add a user to the state if header is missing', async () => {
    // Arrange: Create a default context with no headers
    const [ctx, next] = mockContext();

    // Act
    await addUser(ctx, next);

    // Assert
    expect(ctx.state.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
```

### Example 2: Using a Factory for Common Setups

If many of your tests require an authenticated user, create a factory to keep your tests DRY (Don't Repeat Yourself).

**The Test (`__tests__/protected-routes.test.ts`):**

```typescript
import { mockCtx } from '../src/test-utils';
import { someAdminMiddleware } from '../src/middleware/admin';

// Arrange: Create a factory for an authenticated admin user
const adminContext = mockCtx({
  state: {
    user: { id: 'admin-1', role: 'admin' },
  },
});

describe('someAdminMiddleware', () => {
  it('should allow access for an admin user', async () => {
    // Use the factory to get a pre-configured context
    const [ctx, next] = adminContext();

    await someAdminMiddleware(ctx, next);

    expect(ctx.status).not.toBe(403);
    expect(next).toHaveBeenCalled();
  });

  it('should set a special header when the method is POST', async () => {
    // Use the factory but override the method for this specific test
    const [ctx, next] = adminContext({ method: 'POST' });

    await someAdminMiddleware(ctx, next);

    expect(ctx.response.headers['x-admin-action']).toBe('true');
  });
});
```

### Example 3: Testing a Middleware Chain with `compose`

Often, middleware depend on each other. `compose` lets you test their interaction.

**The Middleware:**

```typescript
// 1. Sets the user
const authMiddleware = async (ctx, next) => {
  ctx.state.user = { id: 'user-1' };
  await next();
};

// 2. Uses the user to fetch data
const fetchDataMiddleware = async (ctx, next) => {
  if (ctx.state.user) {
    ctx.state.data = `data for ${ctx.state.user.id}`;
  }
  await next();
  // 4. Modifies the final response body
  ctx.body = { result: ctx.state.data };
};

// 3. Just logs something
const loggerMiddleware = async (ctx, next) => {
  console.log('Downstream middleware ran');
  await next();
};
```

**The Test:**

```typescript
import { mockContext, compose } from '../src/test-utils';
// Import your middleware...

describe('Full Middleware Chain', () => {
  it('should process the request through all middleware', async () => {
    // Arrange
    const [ctx, finalNext] = mockContext();
    const middlewareChain = compose([
      authMiddleware,
      fetchDataMiddleware,
      loggerMiddleware,
    ]);

    // Act: Run the entire chain
    await middlewareChain(ctx, finalNext);

    // Assert
    expect(ctx.state.user).toBeDefined();
    expect(ctx.state.data).toBe('data for user-1');
    expect(ctx.body).toEqual({ result: 'data for user-1' });
    // Ensure the chain completed
    expect(finalNext).toHaveBeenCalledTimes(1);
  });
});
```
