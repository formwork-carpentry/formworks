import { describe, expect, it } from 'vitest';

import { Container } from '../../../src/core/container/Container.js';
import {
  ExceptionHandler,
  HTTP_EXCEPTION_HANDLER_TOKEN,
} from '../../../src/http/kernel/ExceptionHandler.js';
import { HttpKernel } from '../../../src/http/kernel/HttpKernel.js';
import { Router } from '../../../src/http/router/Router.js';

describe('http/HttpKernel exception handler resolution', () => {
  it('uses explicit exceptionHandler option when provided', () => {
    const container = new Container();
    const router = new Router();
    const injected = new ExceptionHandler(true);

    const kernel = new HttpKernel(container, router, {
      debug: false,
      exceptionHandler: injected,
    });

    expect(kernel.getExceptionHandler()).toBe(injected);
  });

  it('resolves exception handler from container binding when available', () => {
    const container = new Container();
    const router = new Router();
    const bound = new ExceptionHandler(true);
    container.instance(HTTP_EXCEPTION_HANDLER_TOKEN, bound);

    const kernel = new HttpKernel(container, router, { debug: false });

    expect(kernel.getExceptionHandler()).toBe(bound);
  });

  it('registers a tokenized default handler when none is provided', () => {
    const container = new Container();
    const router = new Router();

    const kernel = new HttpKernel(container, router, { debug: true });

    expect(container.bound(HTTP_EXCEPTION_HANDLER_TOKEN)).toBe(true);
    expect(kernel.getExceptionHandler()).toBe(container.make(HTTP_EXCEPTION_HANDLER_TOKEN));
  });
});
