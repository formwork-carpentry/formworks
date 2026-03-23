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
  readonly framework: "solid";
  page: Page;
  resolveComponent(name: string): unknown | null;
  navigate(url: string): void;
}

export function createCarpenterApp(options: CreateCarpenterAppOptions): CarpenterApp {
  return {
    framework: "solid",
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
  href: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  data?: Record<string, unknown>;
  preserveScroll?: boolean;
  preserveState?: boolean;
  replace?: boolean;
  children?: unknown;
}

export interface SolidLinkNode {
  t: "a";
  framework: "solid";
  props: LinkProps;
}

export function Link(props: LinkProps): SolidLinkNode {
  const link = createLink(props.href, {
    method: props.method,
    data: props.data,
    preserveScroll: props.preserveScroll,
    preserveState: props.preserveState,
    replace: props.replace,
  });
  return {
    t: "a",
    framework: "solid",
    props: { ...props, href: link.href, method: link.method },
  };
}
