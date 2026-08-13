import { resolveEnvironment } from "@nepp-chan/shared/constants/environments";

export const ENVIRONMENT = resolveEnvironment(import.meta.env.PUBLIC_ENV);
