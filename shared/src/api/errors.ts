export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const parseErrorResponse = async (res: Response) => {
  try {
    const data = await res.json();
    return (
      data.error?.message ||
      data.message ||
      `リクエストに失敗しました (${res.status})`
    );
  } catch {
    return `リクエストに失敗しました (${res.status})`;
  }
};
