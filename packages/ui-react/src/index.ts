function createLink(
  href: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    data?: Record<string, unknown>;
    preserveScroll?: boolean;
    preserveState?: boolean;
    replace?: boolean;
  },
): {
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  replace?: boolean;
} {
  return { href, method: "GET", ...options };
}

function useCoreForm<T extends Record<string, unknown>>(initial: T) {
  return {
    data: { ...initial },
    errors: {} as Record<string, string[]>,
    processing: false,
    reset(): void {
      this.data = { ...initial };
      this.errors = {};
      this.processing = false;
    },
  };
}

export interface Page<TProps extends Record<string, unknown> = Record<string, unknown>> {
  component: string;
  props: TProps;
  url: string;
  version?: string;
}

export interface CreateCarpenterAppOptions {
  initialPage: Page;
  resolve?: (name: string) => unknown;
  onNavigate?: (url: string) => void;
}

export interface CarpenterApp {
  readonly framework: "react";
  page: Page;
  resolveComponent(name: string): unknown | null;
  navigate(url: string): void;
}

export function createCarpenterApp(options: CreateCarpenterAppOptions): CarpenterApp {
  return {
    framework: "react",
    page: options.initialPage,
    resolveComponent(name: string): unknown | null {
      return options.resolve?.(name) ?? null;
    },
    navigate(url: string): void {
      this.page = { ...this.page, url };
      options.onNavigate?.(url);
    },
  };
}

export function usePage(app: CarpenterApp): Page {
  return app.page;
}

export function useForm<T extends Record<string, unknown>>(initial: T) {
  return useCoreForm(initial);
}

export interface LinkProps {
  href?: string;
  to?: string | RouteGaugerReferenceLike;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  replace?: boolean;
  children?: unknown;
}

export interface RouteGaugerReferenceLike {
  href: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface ReactLinkElement {
  $$typeof: "react.element";
  type: "a";
  key: null;
  ref: null;
  props: LinkProps;
}

export function Link(props: LinkProps): ReactLinkElement {
  const targetHref = resolveTargetHref(props);
  const targetMethod = resolveTargetMethod(props);
  const link = createLink(targetHref, {
    method: targetMethod,
    data: props.data,
    preserveScroll: props.preserveScroll,
    preserveState: props.preserveState,
    replace: props.replace,
  });
  return {
    $$typeof: "react.element",
    type: "a",
    key: null,
    ref: null,
    props: { ...props, href: link.href, method: link.method },
  };
}

function resolveTargetHref(props: LinkProps): string {
  if (typeof props.to === "string") {
    return props.to;
  }

  if (typeof props.to === "object" && props.to !== null && typeof props.to.href === "string") {
    return props.to.href;
  }

  if (typeof props.href === "string") {
    return props.href;
  }

  throw new Error("Link requires either href or to.");
}

function resolveTargetMethod(props: LinkProps): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined {
  if (props.method) {
    return props.method;
  }

  if (typeof props.to === "object" && props.to !== null && props.to.method) {
    return props.to.method;
  }

  return undefined;
}
