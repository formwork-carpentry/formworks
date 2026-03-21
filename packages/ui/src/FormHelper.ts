/**
 * @module @formwork/ui
 * @description Form helpers — framework-agnostic form state management with
 * validation error binding, processing state, and auto-reset.
 *
 * WHY: Every web app needs forms that submit data, show validation errors,
 * and track processing state. This composable provides all of that in a
 * reactive wrapper that works with React, Vue, Svelte, or vanilla JS.
 *
 * HOW: useForm() creates a FormState object. Call form.post(url) to submit.
 * If the server returns 422, errors are automatically populated.
 *
 * @patterns Facade (simple API over fetch + state), Observer (onChange callbacks)
 * @principles SRP (form state only), DIP (depends on fetch interface, not framework)
 *
 * @example
 * ```ts
 * const form = useForm({ name: '', email: '', password: '' });
 *
 * // Submit
 * await form.post('/auth/register');
 *
 * // Check state
 * form.processing  // true while submitting
 * form.errors      // { email: ['Email already taken'] }
 * form.hasErrors    // true
 *
 * // Reset
 * form.reset();           // Reset to initial values
 * form.clearErrors();     // Clear errors only
 * form.setError('email', 'Custom error');
 * ```
 */

/** Validation errors keyed by field name */
export type FormErrors = Record<string, string[]>;

/** Callback for form state changes */
export type FormChangeCallback<T extends Record<string, unknown>> = (form: FormState<T>) => void;

/**
 * FormState — reactive form state with submission, errors, and transforms.
 */
export interface FormState<T extends Record<string, unknown>> {
  /** Current form data */
  data: T;
  /** Validation errors from last submission */
  errors: FormErrors;
  /** True while a submission is in progress */
  processing: boolean;
  /** True if the form was recently submitted successfully */
  recentlySuccessful: boolean;
  /** True if errors is not empty */
  hasErrors: boolean;
  /** True if data has changed from initial values */
  isDirty: boolean;

  /** Submit via POST */
  /**
   * @param {string} url
   * @param {SubmitOptions} [options]
   * @returns {Promise<SubmitResult>}
   */
  post(url: string, options?: SubmitOptions): Promise<SubmitResult>;
  /** Submit via PUT */
  /**
   * @param {string} url
   * @param {SubmitOptions} [options]
   * @returns {Promise<SubmitResult>}
   */
  put(url: string, options?: SubmitOptions): Promise<SubmitResult>;
  /** Submit via PATCH */
  /**
   * @param {string} url
   * @param {SubmitOptions} [options]
   * @returns {Promise<SubmitResult>}
   */
  patch(url: string, options?: SubmitOptions): Promise<SubmitResult>;
  /** Submit via DELETE */
  /**
   * @param {string} url
   * @param {SubmitOptions} [options]
   * @returns {Promise<SubmitResult>}
   */
  delete(url: string, options?: SubmitOptions): Promise<SubmitResult>;
  /** Submit with any method */
  /**
   * @param {string} method
   * @param {string} url
   * @param {SubmitOptions} [options]
   * @returns {Promise<SubmitResult>}
   */
  submit(method: string, url: string, options?: SubmitOptions): Promise<SubmitResult>;

  /** Reset data to initial values and clear errors */
  reset(): void;
  /** Reset only specific fields */
  /**
   * @param {(keyof T} ...fields
   */
  resetFields(...fields: (keyof T)[]): void;
  /** Clear all errors */
  clearErrors(): void;
  /** Clear error for a specific field */
  /**
   * @param {keyof T} field
   */
  clearError(field: keyof T): void;
  /** Set a manual error */
  /**
   * @param {string} field
   * @param {string} message
   */
  setError(field: string, message: string): void;
  /** Transform data before submission */
  /**
   * @param {(data: T} fn
   * @returns {FormState<T>}
   */
  transform(fn: (data: T) => Record<string, unknown>): FormState<T>;
  /** Register a change callback */
  /**
   * @param {FormChangeCallback<T>} cb
   */
  onChange(cb: FormChangeCallback<T>): void;
}

export interface SubmitOptions {
  /** Custom headers */
  headers?: Record<string, string>;
  /** Called before submission */
  onBefore?: () => void;
  /** Called on success (2xx) */
  onSuccess?: (response: unknown) => void;
  /** Called on validation error (422) */
  onError?: (errors: FormErrors) => void;
  /** Called on any completion */
  onFinish?: () => void;
  /** Custom fetch function (for testing) */
  fetchFn?: typeof fetch;
}

export interface SubmitResult {
  ok: boolean;
  status: number;
  data: unknown;
  errors: FormErrors;
}

function hasValidationErrors(data: unknown): data is { errors: FormErrors } {
  if (typeof data !== "object" || data === null || !("errors" in data)) {
    return false;
  }

  const { errors } = data as { errors: unknown };
  if (typeof errors !== "object" || errors === null) {
    return false;
  }

  return Object.values(errors).every(
    (value) => Array.isArray(value) && value.every((item) => typeof item === "string"),
  );
}

/**
 * Create a reactive form state object.
 *
 * @example
 * ```ts
 * const form = useForm({ title: '', body: '', category: 'general' });
 *
 * // In a React component:
 * <input value={form.data.title} onChange={e => form.data.title = e.target.value} />
 * {form.errors.title && <span className="error">{form.errors.title[0]}</span>}
 *
 * <button onClick={() => form.post('/api/posts')} disabled={form.processing}>
 *   {form.processing ? 'Saving...' : 'Save'}
 * </button>
 * ```
 */
export function useForm<T extends Record<string, unknown>>(initial: T): FormState<T> {
  const initialData = { ...initial };
  let transformFn: ((data: T) => Record<string, unknown>) | null = null;
  const listeners: FormChangeCallback<T>[] = [];

  const form: FormState<T> = {
    data: { ...initial },
    errors: {},
    processing: false,
    recentlySuccessful: false,

    get hasErrors() {
      return Object.keys(this.errors).length > 0;
    },
    get isDirty() {
      return JSON.stringify(this.data) !== JSON.stringify(initialData);
    },

    async post(url, options?) {
      return this.submit("POST", url, options);
    },
    async put(url, options?) {
      return this.submit("PUT", url, options);
    },
    async patch(url, options?) {
      return this.submit("PATCH", url, options);
    },
    async delete(url, options?) {
      return this.submit("DELETE", url, options);
    },

    async submit(method, url, options = {}): Promise<SubmitResult> {
      options.onBefore?.();
      this.processing = true;
      this.clearErrors();
      notify(this);

      const fetchFn = options.fetchFn ?? globalThis.fetch;
      const body = transformFn ? transformFn(this.data) : this.data;

      try {
        const response = await fetchFn(url, {
          method,
          headers: { "Content-Type": "application/json", ...options.headers },
          body: method !== "GET" ? JSON.stringify(body) : undefined,
        });

        const responseData: unknown = await response.json().catch(() => ({}));

        if (response.status === 422 && hasValidationErrors(responseData)) {
          this.errors = responseData.errors;
          options.onError?.(this.errors);
          return { ok: false, status: 422, data: responseData, errors: this.errors };
        }

        if (response.ok) {
          this.recentlySuccessful = true;
          setTimeout(() => {
            this.recentlySuccessful = false;
          }, 2000);
          options.onSuccess?.(responseData);
        }

        return { ok: response.ok, status: response.status, data: responseData, errors: {} };
      } finally {
        this.processing = false;
        options.onFinish?.();
        notify(this);
      }
    },

    reset() {
      Object.assign(this.data, initialData);
      this.errors = {};
      this.processing = false;
      notify(this);
    },

    resetFields(...fields) {
      for (const f of fields) {
        (this.data as Record<string, unknown>)[f as string] = initialData[f];
      }
      notify(this);
    },

    clearErrors() {
      this.errors = {};
    },
    clearError(field) {
      delete this.errors[field as string];
    },
    setError(field, message) {
      if (!this.errors[field]) this.errors[field] = [];
      this.errors[field].push(message);
    },

    transform(fn) {
      transformFn = fn;
      return this;
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };

  function notify(f: FormState<T>) {
    for (const cb of listeners) cb(f);
  }

  return form;
}
