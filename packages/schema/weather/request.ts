import { z } from "zod";

export const WeatherQuerySchema = z.object({
  city: z.string().optional().default("tokyo"),
});

export type WeatherQuery = z.infer<typeof WeatherQuerySchema>;
