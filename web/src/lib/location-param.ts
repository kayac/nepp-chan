import { getCurrentSearchParams } from "~/lib/redirect";

export const getLocationParam = () =>
  getCurrentSearchParams().get("location") || null;
