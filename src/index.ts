import { jest } from '@jest/globals';
import httpAssert from 'http-assert';
import HttpErrors from 'http-errors';
import * as Koa from 'koa';

export { httpAssert, HttpErrors };

export interface MockContextOptions {
  status?: number;
  body?: unknown;
  message?: string;
  headers?: Record<string, string | string[]>;
  method?: string;
  url?: string;
  host?: string;
  hostname?: string;
  protocol?: string;
  requestHeaders?: Record<string, string | string[]>;
  cookies?: Record<string, string>;
  state?: Record<string, any>;
  app?: Partial<Koa>;
  [key: string]: any;
}

export interface MockKoaContext extends Koa.Context {
  setBody(body: unknown): void;
  setHeaders(headers: Record<string, string | string[]>): void;
  setCookies(cookies: Record<string, string>): void;
}

export type MockKoaNext = jest.Mock<() => Promise<any>>;

function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map((item) => deepClone(item)) as any;
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

function normalizeHeaders(headers: Record<string, any> = {}) {
  const result: Record<string, any> = {};
  for (const key in headers) {
    result[key.toLowerCase()] = headers[key];
  }
  return result;
}

export function compose(middleware: Koa.Middleware[]) {
  return function (context: Koa.Context, next?: Koa.Next) {
    let index = -1;
    const dispatch = (i: number): Promise<void> => {
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;
      const fn = middleware[i];
      if (!fn) {
        return next ? next() : Promise.resolve();
      }
      try {
        const nextDispatch = () => dispatch(i + 1);
        return Promise.resolve(fn(context, nextDispatch));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return dispatch(0);
  };
}

export function mockCtx(baseOptions: MockContextOptions = {}) {
  return (
    overrideOptions: MockContextOptions = {}
  ): [MockKoaContext, MockKoaNext] => {
    const mergedOptions: MockContextOptions = {
      ...baseOptions,
      ...overrideOptions,
      state: { ...baseOptions.state, ...overrideOptions.state },
      headers: { ...baseOptions.headers, ...overrideOptions.headers },
      requestHeaders: {
        ...baseOptions.requestHeaders,
        ...overrideOptions.requestHeaders,
      },
      cookies: { ...baseOptions.cookies, ...overrideOptions.cookies },
    };
    const options = deepClone(mergedOptions);

    const ctx = {} as MockKoaContext;
    const request = {} as Koa.Request;
    const response = {} as Koa.Response;

    const app = options.app ?? {
      emit: jest.fn(),
      onerror: (err: Error) => console.error('Mocked app.onerror:', err),
    };
    const state = options.state ?? {};
    const cookies = options.cookies ?? {};

    const finalRequestHeaders = normalizeHeaders({
      ...options.headers,
      ...options.requestHeaders,
    });

    Object.assign(response, {
      ctx,
      app,
      request,
      status: options.status ?? 200,
      body: options.body ?? null,
      message: options.message ?? 'OK',
      headers: {} as Record<string, string | string[]>,
      set(field: string | { [key: string]: any }, val: any) {
        if (typeof field === 'string') {
          this.headers[field.toLowerCase()] = val;
        } else {
          for (const key in field) this.headers[key.toLowerCase()] = field[key];
        }
      },
      redirect(url: string) {
        this.set('Location', url);
        this.status = 302;
      },
    });

    Object.assign(request, {
      ctx,
      app,
      response,
      headers: finalRequestHeaders,
      method: options.method ?? 'GET',
      url: options.url ?? '/',
      host: options.host ?? 'test.com',
      hostname: options.hostname ?? 'test.com',
      protocol: options.protocol ?? 'http',
      secure: options.protocol === 'https',
      get(field: string): string {
        const lowerField = field.toLowerCase();
        const headerValue = this.headers[lowerField];
        return (
          (Array.isArray(headerValue) ? headerValue.join(',') : headerValue) ??
          ''
        );
      },
    });

    Object.assign(ctx, {
      ...options,
      request,
      response,
      app,
      state,
      cookies: {
        get: (name: string) => cookies[name],
        set: (name: string, value: string) => (cookies[name] = value),
      },
      assert: httpAssert,
      throw: (...args: any[]) => {
        throw HttpErrors(...args);
      },

      setBody(body: unknown) {
        this.body = body;
      },
      setHeaders(headers: Record<string, string | string[]>) {
        this.headers = headers;
      },
      setCookies(newCookies: Record<string, string>) {
        Object.assign(cookies, newCookies);
      },
    });

    Object.defineProperties(ctx, {
      header: { get: () => request.headers },
      headers: { get: () => request.headers },
      method: {
        get: () => request.method,
        set: (val) => (request.method = val),
      },
      url: { get: () => request.url, set: (val) => (request.url = val) },
      get: { value: request.get.bind(request) },

      body: { get: () => response.body, set: (val) => (response.body = val) },
      status: {
        get: () => response.status,
        set: (val) => (response.status = val),
      },
      message: {
        get: () => response.message,
        set: (val) => (response.message = val),
      },
      redirect: { value: response.redirect.bind(response) },
      set: { value: response.set.bind(response) },
    });

    const next: MockKoaNext = jest.fn();
    return [ctx, next];
  };
}

export const mockContext = mockCtx();
