import * as Koa from 'koa';

import { compose, mockContext, mockCtx, MockKoaContext } from '../src';

describe('Koa Mock Context Utility', () => {
  describe('Factory and Instantiation', () => {
    it('should create a default context with expected values', () => {
      const [ctx, next] = mockContext();

      expect(ctx.status).toBe(200);
      expect(ctx.body).toBeNull();
      expect(ctx.state).toEqual({});

      expect(ctx.method).toBe('GET');
      expect(ctx.url).toBe('/');
      expect(next).not.toHaveBeenCalled();
    });

    it('should "bake" a base context and use its properties', () => {
      const baseContextFactory = mockCtx({
        state: { tenantId: 'tenant-123' },
        headers: { 'x-request-id': 'abc-123' },
      });

      const [ctx] = baseContextFactory();

      expect(ctx.state.tenantId).toBe('tenant-123');
      expect(ctx.get('x-request-id')).toBe('abc-123');
    });

    it('should allow overriding baked properties for a single test', () => {
      const baseContextFactory = mockCtx({
        state: { tenantId: 'tenant-123', user: null },
        headers: { 'x-request-id': 'abc-123' },
      });

      const [ctx] = baseContextFactory({
        state: { user: { id: 1 } },
        method: 'POST',
      });

      expect(ctx.state.user).toEqual({ id: 1 });

      expect(ctx.method).toBe('POST');
      expect(ctx.state.tenantId).toBe('tenant-123');
      expect(ctx.get('x-request-id')).toBe('abc-123');
    });

    it('should ensure contexts are isolated from each other', () => {
      const factory = mockCtx({ state: { count: 0 } });

      const [ctx1] = factory();
      const [ctx2] = factory();
      ctx1.state.count = 100;
      expect(ctx1.state.count).toBe(100);
      expect(ctx2.state.count).toBe(0);
    });
  });

  describe('Context Property Mocking', () => {
    it('should get and set the response status code', () => {
      const [ctx] = mockContext();
      ctx.status = 404;
      expect(ctx.status).toBe(404);
    });

    it('should get and set the response body', () => {
      const [ctx] = mockContext();
      const responseBody = { data: 'test-data' };
      ctx.body = responseBody;
      expect(ctx.body).toEqual(responseBody);
    });

    it('should set response headers (case-insensitively)', () => {
      const [ctx] = mockContext();
      ctx.set('X-Custom-Header', 'my-value');
      expect(ctx.response.headers['x-custom-header']).toBe('my-value');
    });

    it('should get request headers (case-insensitively)', () => {
      const [ctx] = mockContext({
        headers: { 'Content-Type': 'application/json' },
      });

      expect(ctx.get('content-type')).toBe('application/json');
    });

    it('should get and set cookies', () => {
      const [ctx] = mockContext({ cookies: { initialCookie: 'hello' } });

      expect(ctx.cookies.get('initialCookie')).toBe('hello');
      ctx.cookies.set('session', 'abc-xyz-123');
      expect(ctx.cookies.get('session')).toBe('abc-xyz-123');
    });

    it('should correctly mock a redirect', () => {
      const [ctx] = mockContext();
      ctx.redirect('/login');
      expect(ctx.status).toBe(302);
      expect(ctx.response.headers.location).toBe('/login');
    });
  });

  describe('Middleware Workflow Simulation', () => {
    const fakeUserMiddleware = async (ctx: MockKoaContext, next: Koa.Next) => {
      ctx.assert(ctx.get('Authorization'), 401, 'Auth header required');
      ctx.state.user = { id: 'user-1', name: 'Test User' };
      ctx.status = 201;
      ctx.set('X-Middleware-Ran', 'true');
      ctx.cookies.set('post-auth-cookie', 'granted');
      await next();
      ctx.body = {
        data: ctx.state.user,
        downstreamMessage: ctx.state.downstreamMessage,
      };
    };

    const fakeDownstreamMiddleware = async (
      ctx: MockKoaContext,
      next: Koa.Next
    ) => {
      ctx.state.downstreamMessage = 'Hello from downstream!';
      await next();
    };

    it('should correctly reflect context changes when using compose', async () => {
      const [ctx, next] = mockContext({
        headers: { Authorization: 'Bearer some-token' },
      });

      const middlewareChain = [fakeUserMiddleware, fakeDownstreamMiddleware];

      const composedMiddleware = compose(middlewareChain as Koa.Middleware[]);
      await composedMiddleware(ctx, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(ctx.status).toBe(201);
      expect(ctx.body).toEqual({
        data: { id: 'user-1', name: 'Test User' },
        downstreamMessage: 'Hello from downstream!',
      });

      expect(ctx.response.headers['x-middleware-ran']).toBe('true');
      expect(ctx.cookies.get('post-auth-cookie')).toBe('granted');
    });
  });

  describe('Error Handling', () => {
    it('should correctly throw an error using ctx.throw', async () => {
      const [ctx] = mockContext();
      const errorMiddleware = async () => {
        ctx.throw(422, 'Validation Failed', {
          details: 'Field `name` is required.',
        });
      };
      await expect(errorMiddleware()).rejects.toThrow('Validation Failed');
      try {
        await errorMiddleware();
      } catch (error: any) {
        expect(error.status).toBe(422);
        expect(error.details).toBe('Field `name` is required.');
      }
    });

    it('should not throw when ctx.assert condition is truthy', () => {
      const [ctx] = mockContext();
      const assertion = () => ctx.assert(true, 400, 'This should not throw');
      expect(assertion).not.toThrow();
    });

    it('should throw when ctx.assert condition is falsy', () => {
      const [ctx] = mockContext();
      const user = null;
      const assertion = () => ctx.assert(user, 404, 'User not found');
      expect(assertion).toThrow('User not found');
      expect(assertion).toThrow(expect.objectContaining({ status: 404 }));
    });
  });
});
