import { z } from "zod";

export const WeatherResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    city: z.string(),
    temperature: z.number(),
    description: z.string(),
  }),
});

export type WeatherResponse = z.infer<typeof WeatherResponseSchema>;
