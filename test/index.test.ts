import * as Koa from 'koa';
import { compose, mockContext, MockKoaContext } from '../src';

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

    it('should "bake" a base context using the factory', () => {
      const baseContextFactory = mockContext.factory({
        state: { tenantId: 'tenant-123' },
        headers: { 'x-request-id': 'abc-123' },
      });

      const [ctx] = baseContextFactory();

      expect(ctx.state.tenantId).toBe('tenant-123');
      expect(ctx.get('x-request-id')).toBe('abc-123');
    });

    it('should allow overriding baked properties for a single test', () => {
      const baseContextFactory = mockContext.factory({
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
      const factory = mockContext.factory({ state: { count: 0 } });

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

  describe('File Upload Mocking', () => {
    it('should correctly mock a single file upload', () => {
      const [ctx] = mockContext({
        files: {
          avatar: {
            filepath: '/tmp/abc-123',
            originalFilename: 'my-photo.jpg',
            mimetype: 'image/jpeg',
            size: 54321,
          },
        },
      });

      expect(ctx.request.files).toBeDefined();
      const avatarFile = ctx.request.files?.avatar;
      expect(avatarFile).toBeDefined();
      expect(Array.isArray(avatarFile)).toBe(false);

      if (Array.isArray(avatarFile) || !avatarFile) {
        fail('File should be a single object');
      }

      expect(avatarFile.filepath).toBe('/tmp/abc-123');
      expect(avatarFile.originalFilename).toBe('my-photo.jpg');
      expect(avatarFile.mimetype).toBe('image/jpeg');
      expect(avatarFile.size).toBe(54321);
      expect(avatarFile.lastModifiedDate).toBeInstanceOf(Date);
    });

    it('should apply default values for optional file properties', () => {
      const [ctx] = mockContext({
        files: {
          document: {
            filepath: '/tmp/required-path',
          },
        },
      });

      const docFile = ctx.request.files?.document;
      if (Array.isArray(docFile) || !docFile) {
        fail('File should be a single object');
      }

      expect(docFile.size).toBe(0);
      expect(docFile.originalFilename).toBe('mockfile.txt');
      expect(docFile.mimetype).toBe('application/octet-stream');
    });

    it('should correctly mock multiple files for a single field name', () => {
      const [ctx] = mockContext({
        files: {
          gallery: [
            { filepath: '/tmp/img1.png', originalFilename: 'img1.png' },
            { filepath: '/tmp/img2.png', originalFilename: 'img2.png' },
          ],
        },
      });

      expect(ctx.request.files).toBeDefined();
      const galleryFiles = ctx.request.files?.gallery;
      expect(galleryFiles).toBeDefined();
      expect(Array.isArray(galleryFiles)).toBe(true);

      if (!Array.isArray(galleryFiles)) {
        fail('Files should be an array');
      }

      expect(galleryFiles).toHaveLength(2);
      expect(galleryFiles[0].originalFilename).toBe('img1.png');
      expect(galleryFiles[1].filepath).toBe('/tmp/img2.png');
    });

    it('should handle multiple file fields in the same request', () => {
      const [ctx] = mockContext({
        files: {
          profile: { filepath: '/tmp/profile.jpg' },
          banner: { filepath: '/tmp/banner.png' },
        },
      });

      expect(ctx.request.files?.profile).toBeDefined();
      expect(ctx.request.files?.banner).toBeDefined();
      expect((ctx.request.files?.profile as any).filepath).toBe(
        '/tmp/profile.jpg'
      );
    });

    it('should return undefined for files if none are provided', () => {
      const [ctx] = mockContext();
      expect(ctx.request.files).toEqual({});
    });

    it('should merge files when using a factory', () => {
      const factory = mockContext.factory({
        files: {
          defaultConfig: { filepath: '/etc/config.json' },
        },
      });

      const [ctx] = factory({
        files: {
          userUpload: { filepath: '/home/user/upload.txt' },
        },
      });

      expect(ctx.request.files?.defaultConfig).toBeDefined();
      expect(ctx.request.files?.userUpload).toBeDefined();
      expect((ctx.request.files?.defaultConfig as any).filepath).toBe(
        '/etc/config.json'
      );
      expect((ctx.request.files?.userUpload as any).filepath).toBe(
        '/home/user/upload.txt'
      );
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

  describe('Context Helper Methods', () => {
    it('should set the request body using the setBody helper', () => {
      const [ctx] = mockContext();
      ctx.setBody({ success: true });
      expect(ctx.request.body).toEqual({ success: true });
    });

    it('should set request headers using the setHeaders helper', () => {
      const [ctx] = mockContext();
      ctx.setHeaders({ 'x-api-key': '12345' });
      expect(ctx.get('x-api-key')).toBe('12345');
    });

    it('should set cookies using the setCookies helper', () => {
      const [ctx] = mockContext();
      ctx.setCookies({ theme: 'dark' });
      expect(ctx.cookies.get('theme')).toBe('dark');
    });
  });

  describe('Context Property Setters', () => {
    it('should allow directly setting ctx.method', () => {
      const [ctx] = mockContext();
      ctx.method = 'PUT';
      expect(ctx.method).toBe('PUT');
    });

    it('should allow directly setting ctx.url', () => {
      const [ctx] = mockContext();
      ctx.url = '/users/123';
      expect(ctx.url).toBe('/users/123');
    });

    it('should allow directly setting ctx.message', () => {
      const [ctx] = mockContext();
      ctx.message = 'Payment Required';
      expect(ctx.message).toBe('Payment Required');
    });

    it('should allow getting and setting the request body via requestBody alias', () => {
      const [ctx] = mockContext({ body: { initial: true } });
      expect(ctx.requestBody).toEqual({ initial: true });

      ctx.requestBody = { updated: true };
      expect(ctx.request.body).toEqual({ updated: true });
    });

    it('should set multiple response headers when an object is passed to ctx.set', () => {
      const [ctx] = mockContext();
      ctx.set({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '99',
      });
      expect(ctx.response.headers['x-ratelimit-limit']).toBe('100');
      expect(ctx.response.headers['x-ratelimit-remaining']).toBe('99');
    });
  });

  describe('compose function error handling', () => {
    it('should reject if next() is called multiple times', async () => {
      const [ctx, next] = mockContext();
      const middleware = compose([
        async (ctx, next) => {
          await next();
          await next();
        },
      ]);

      await expect(middleware(ctx, next)).rejects.toThrow(
        'next() called multiple times'
      );
    });

    it('should reject if a middleware throws a synchronous error', async () => {
      const [ctx, next] = mockContext();
      const middleware = compose([
        () => {
          throw new Error('Synchronous error!');
        },
      ]);

      await expect(middleware(ctx, next)).rejects.toThrow('Synchronous error!');
    });
  });

  describe('Default app.onerror', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should trigger the default app.onerror when an error is thrown', () => {
      const [ctx] = mockContext();
      const testError = new Error('Test app error');

      ctx.app.onerror?.(testError);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Mocked app.onerror:',
        testError
      );
    });
  });

  it('should correctly alias ctx.header and ctx.headers to request.headers', () => {
    const testHeaders = {
      'x-custom-1': 'value1',
      'x-custom-2': 'value2',
    };
    const [ctx] = mockContext({ headers: testHeaders });

    expect(ctx.header).toEqual(testHeaders);
    expect(ctx.headers).toEqual(testHeaders);

    expect(ctx.header).toBe(ctx.request.headers);
    expect(ctx.headers).toBe(ctx.request.headers);
  });

  describe('Branch Coverage Edge Cases', () => {
    it('should use the provided app, state, and cookies objects instead of defaults', () => {
      const mockApp = {
        emit: jest.fn(),
        env: 'test',
      };
      const mockInitialState = { initial: true };
      const mockInitialCookies = { 'pre-set': 'true' };

      const [ctx] = mockContext({
        app: mockApp,
        state: mockInitialState,
        cookies: mockInitialCookies,
      });

      expect(ctx.app).toBe(mockApp);
      expect(ctx.state).toEqual(mockInitialState);
      expect(ctx.cookies.get('pre-set')).toBe('true');
    });

    it('should correctly join a header value that is an array of strings', () => {
      const [ctx] = mockContext({
        headers: {
          'Accept-Encoding': ['gzip', 'deflate', 'br'],
        },
      });

      expect(ctx.get('Accept-Encoding')).toBe('gzip,deflate,br');
    });

    it('should resolve successfully when compose is called without a final next function', async () => {
      let middlewareRan = false;
      const middleware = compose([
        async (ctx, next) => {
          middlewareRan = true;
          await next();
        },
      ]);

      const [ctx] = mockContext();

      await expect(middleware(ctx)).resolves.toBeUndefined();
      expect(middlewareRan).toBe(true);
    });
  });
});
