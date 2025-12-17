import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { StatusCode } from "hono/utils/http-status";

type ErrorResponse = {
  error: {
    code: StatusCode;
    message: string;
  };
};

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      console.error("HTTPException", {
        message: err.message,
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

  console.error("Unhandled exception", {
    name: err.name,
    message: err.message,
    cause: err.cause,
    stack: err.stack,
  });

  const message =
    err instanceof Error && err.message
      ? err.message
      : "An unexpected error occurred";

  return c.json<ErrorResponse>(
    {
      error: {
        code: 500,
        message,
      },
    },
    500,
  );
};
