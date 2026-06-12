import { getCurrentSearchParams } from "~/lib/redirect";

/** クエリ ?location=... を返す。未指定・空なら null */
export const getLocationParam = () =>
  getCurrentSearchParams().get("location") || null;
