import { AppError, type AppErrorCode } from "@/lib/app/types";

export function toAppError(
  error: unknown,
  fallbackCode: AppErrorCode = "DATABASE_ERROR",
): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    return new AppError(fallbackCode, error.message, error);
  }

  return new AppError(fallbackCode, "An unexpected application error occurred.", error);
}

export function getErrorMessage(error: unknown): string {
  return toAppError(error).message;
}
