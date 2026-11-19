/** Every API error uses one shape: { error: { code, message, ...extra } } */
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
export const badRequest = (message, fields) =>
  new HttpError(400, 'VALIDATION_ERROR', message, fields ? { fields } : {});
export const unauthorized = (message = 'Please sign in first') => new HttpError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'You are not allowed to do this', code = 'FORBIDDEN') => new HttpError(403, code, message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code, message, extra) => new HttpError(409, code, message, extra);

export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
  }
  if (err?.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Each image must be 5 MB or smaller',
      LIMIT_FILE_COUNT: 'You can upload at most 5 images',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field (use "images")',
    };
    return res.status(400).json({ error: { code: err.code, message: messages[err.code] || err.message } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Request body is too large' } });
  }
  if (err?.code === 'SQLITE_BUSY') {
    return res.status(503).json({ error: { code: 'BUSY', message: 'Server is busy, please try again' } });
  }
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: { code: err.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', message: err.status === 404 ? 'Not found' : 'Bad request' } });
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side' } });
}
