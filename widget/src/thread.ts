export const createThread = async (
  apiUrl: string,
  token: string,
): Promise<string> => {
  const res = await fetch(`${apiUrl}/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`スレッドの作成に失敗しました: ${res.status}`);
  }

  const thread = (await res.json()) as { id: string };
  return thread.id;
};
