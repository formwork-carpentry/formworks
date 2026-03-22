/**
 * @module @formwork/core/contracts/http
 * @description HTTP contracts - request, response, routing, and middleware interfaces.
 *
 * Implementations: Request, CarpenterResponse, Router, HttpKernel, Pipeline
 *
 * @example
 * ```ts
 * router.get('/api/users/:id', async (req: IRequest) => {
 *   const id = req.param('id');
 *   return CarpenterResponse.json({ data: await User.findOrFail(id) });
 * });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map