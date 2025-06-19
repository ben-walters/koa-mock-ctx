import { jest } from '@jest/globals';
import httpAssert from 'http-assert';
import HttpErrors from 'http-errors';
import * as Koa from 'koa';

export { httpAssert, HttpErrors };

export interface UploadedFile {
  size: number;
  filepath: string;
  originalFilename: string | null;
  mimetype: string | null;
  lastModifiedDate: Date | null;
}

export interface MockFile {
  filepath: string;
  size?: number;
  originalFilename?: string;
  mimetype?: string;
}

export interface MockKoaRequest extends Koa.Request {
  body?: unknown;
  files?: Record<string, UploadedFile | UploadedFile[]>;
}

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
  files?: Record<string, MockFile | MockFile[]>;
  [key: string]: any;
}

export interface MockKoaContext extends Koa.Context {
  request: MockKoaRequest;
  setBody(body: unknown): void;
  setHeaders(headers: Record<string, string | string[]>): void;
  setCookies(cookies: Record<string, string>): void;
}

export type MockKoaNext = jest.Mock<() => Promise<any>>;

function normalizeHeaders(headers: Record<string, any> = {}) {
  const result: Record<string, any> = {};
  for (const key in headers) {
    result[key.toLowerCase()] = headers[key];
  }
  return result;
}

function createUploadedFile(mockFile: MockFile): UploadedFile {
  return {
    size: mockFile.size ?? 0,
    filepath: mockFile.filepath,
    originalFilename: mockFile.originalFilename ?? 'mockfile.txt',
    mimetype: mockFile.mimetype ?? 'application/octet-stream',
    lastModifiedDate: new Date(),
  };
}

function processMockFiles(
  files: Record<string, MockFile | MockFile[]>
): Record<string, UploadedFile | UploadedFile[]> {
  const processed: Record<string, UploadedFile | UploadedFile[]> = {};
  for (const key in files) {
    const fileOrFiles = files[key];
    if (Array.isArray(fileOrFiles)) {
      processed[key] = fileOrFiles.map(createUploadedFile);
    } else {
      processed[key] = createUploadedFile(fileOrFiles);
    }
  }
  return processed;
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
        return Promise.resolve(fn(context, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return dispatch(0);
  };
}

function createMockGenerator(baseOptions: MockContextOptions = {}) {
  return (
    overrideOptions: MockContextOptions = {}
  ): [MockKoaContext, MockKoaNext] => {
    const mergedForCloning = {
      ...baseOptions,
      ...overrideOptions,
      state: { ...baseOptions.state, ...overrideOptions.state },
      headers: {
        ...baseOptions.headers,
        ...baseOptions.requestHeaders,
        ...overrideOptions.headers,
        ...overrideOptions.requestHeaders,
      },
      cookies: { ...baseOptions.cookies, ...overrideOptions.cookies },
      files: { ...baseOptions.files, ...overrideOptions.files },
    };

    const { app, ...restOfOptions } = mergedForCloning;

    const options = structuredClone(restOfOptions);

    const processedFiles = options.files
      ? processMockFiles(options.files)
      : undefined;

    const ctx = {} as MockKoaContext;
    const request = {
      body: options.body,
      files: processedFiles,
    } as MockKoaRequest;
    const response = {} as Koa.Response;

    const finalApp = app ?? {
      emit: jest.fn(),
      onerror: (err: Error) => console.error('Mocked app.onerror:', err),
    };
    const state = options.state ?? {};
    const cookies = options.cookies ?? {};

    Object.assign(response, {
      ctx,
      app: finalApp,
      request,
      status: options.status ?? 200,
      body: null,
      message: options.message ?? 'OK',
      headers: {} as Record<string, string | string[]>,
      set(field: string | { [key: string]: any }, val?: any) {
        if (typeof field === 'string') {
          this.headers[field.toLowerCase()] = val;
        } else {
          for (const key in field) {
            this.headers[key.toLowerCase()] = field[key];
          }
        }
      },
      redirect(url: string) {
        this.set('Location', url);
        this.status = 302;
      },
    });

    Object.assign(request, {
      ctx,
      app: finalApp,
      response,
      headers: normalizeHeaders(options.headers),
      method: options.method ?? 'GET',
      url: options.url ?? '/',
      host: options.host ?? 'test.com',
      hostname: options.hostname ?? 'test.com',
      protocol: options.protocol ?? 'http',
      secure: options.protocol === 'https',
      get(field: string): string {
        const headerValue = this.headers[field.toLowerCase()];
        return Array.isArray(headerValue) ? headerValue.join(',') : headerValue;
      },
    });

    Object.assign(ctx, {
      ...options,
      request,
      response,
      app: finalApp,
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
        this.request.body = body;
      },
      setHeaders(headers: Record<string, string | string[]>) {
        for (const key in headers) {
          this.request.headers[key.toLowerCase()] = headers[key];
        }
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
      requestBody: {
        get: () => request.body,
        set: (val) => (request.body = val),
      },
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

type MockContextFunction = {
  (options?: MockContextOptions): [MockKoaContext, MockKoaNext];
  factory: (
    baseOptions?: MockContextOptions
  ) => (overrideOptions?: MockContextOptions) => [MockKoaContext, MockKoaNext];
};

export const mockContext = createMockGenerator({}) as MockContextFunction;

mockContext.factory = (baseOptions) => createMockGenerator(baseOptions);
