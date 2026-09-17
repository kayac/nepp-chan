import { ENVIRONMENT } from "./environment";

export const API_URL = import.meta.env.PUBLIC_API_URL ?? ENVIRONMENT.api;
export const LP_URL = ENVIRONMENT.lp;
