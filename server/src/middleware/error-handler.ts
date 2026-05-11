import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";
import { logger } from "~/lib/logger";

type ErrorResponse = {
  error: {
    code: StatusCode;
    message: string;
  };
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      logger.error("HTTPException", err, {
        status: err.status,
      });
    }

    return c.json<ErrorResponse>(
      {
        error: {
          code: err.status,
          message: err.message,
        },
      },
      err.status,
    );
  }

  logger.error("Unhandled exception", err);

  return c.json<ErrorResponse>(
    {
      error: {
        code: 500,
        message: "内部エラーが発生しました。しばらく経ってからお試しください。",
      },
    },
    500,
  );
};
