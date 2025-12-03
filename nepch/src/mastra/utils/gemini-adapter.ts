import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Recursively transforms a Zod schema to be compatible with Gemini API.
 * - Converts z.any(), z.record(), and z.unknown() to z.string() (JSON string).
 * - Converts z.nullable() to z.optional() (removes null type).
 * - Adds "(JSON string)" to description for converted fields.
 */
function transformToGeminiSchema(schema: any): any {
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const newShape: any = {};
        for (const key in shape) {
            newShape[key] = transformToGeminiSchema(shape[key]);
        }
        return z.object(newShape);
    }

    if (schema instanceof z.ZodOptional) {
        return transformToGeminiSchema(schema.unwrap()).nullable().optional();
    }

    if (schema instanceof z.ZodNullable) {
        // Gemini sends null for optional fields, so we must allow it.
        // We unwrap to handle the inner type, but keep it nullable in the output if possible,
        // or rely on the fact that we make things optional.
        // Actually, best to return transform(inner).nullable().optional() to be safe.
        return transformToGeminiSchema(schema.unwrap()).nullable().optional();
    }

    if (schema instanceof z.ZodArray) {
        return z.array(transformToGeminiSchema(schema.element));
    }

    // Convert unsupported types to string (JSON string)
    if (
        schema instanceof z.ZodAny ||
        schema instanceof z.ZodRecord ||
        schema instanceof z.ZodUnknown
    ) {
        let description = schema.description || '';
        if (!description.includes('(JSON string)')) {
            description += ' (JSON string)';
        }
        // Always make it nullable and optional to be safe with Gemini
        return z.string().nullable().optional().describe(description);
    }

    // Pass through other types (string, number, boolean, enum, etc.)
    return schema;
}

/**
 * Hydrates the context by parsing JSON strings back to objects
 * based on the original schema.
 */
function hydrateContext(context: any, originalSchema: any): any {
    if (!context || typeof context !== 'object') {
        return context;
    }

    // If original schema is ZodObject, iterate keys
    if (originalSchema instanceof z.ZodObject) {
        const shape = originalSchema.shape;
        const newContext: any = { ...context };

        for (const key in context) {
            const fieldSchema = shape[key];
            if (!fieldSchema) continue;

            // Handle Optional/Nullable wrappers to find the underlying type
            let underlyingSchema = fieldSchema;
            while (
                underlyingSchema instanceof z.ZodOptional ||
                underlyingSchema instanceof z.ZodNullable
            ) {
                underlyingSchema = underlyingSchema.unwrap();
            }

            // If the original field was Any/Record/Unknown, try to parse the string input
            if (
                (underlyingSchema instanceof z.ZodAny ||
                    underlyingSchema instanceof z.ZodRecord ||
                    underlyingSchema instanceof z.ZodUnknown) &&
                typeof context[key] === 'string'
            ) {
                try {
                    newContext[key] = JSON.parse(context[key]);
                } catch (e) {
                    // Keep as string if parse fails
                    console.warn(`Failed to parse JSON for field ${key}:`, e);
                }
            } else if (underlyingSchema instanceof z.ZodObject) {
                // Recursively hydrate nested objects
                newContext[key] = hydrateContext(context[key], underlyingSchema);
            } else if (underlyingSchema instanceof z.ZodArray) {
                // Recursively hydrate arrays
                if (Array.isArray(context[key])) {
                    newContext[key] = context[key].map((item: any) =>
                        hydrateContext(item, underlyingSchema.element)
                    );
                }
            }

            // Sanitize null to undefined if the value is null
            // This is needed because we allow Gemini to send null for optional fields,
            // but the original schema might strictly expect undefined (if it's optional but not nullable).
            if (newContext[key] === null) {
                newContext[key] = undefined;
            }
        }
        return newContext;
    }

    return context;
}

/**
 * Wraps a Mastra tool to make it compatible with Gemini API.
 */
export function asGeminiTool(originalTool: any) {
    const geminiSafeSchema = transformToGeminiSchema(originalTool.inputSchema);
    // console.log(`[GeminiAdapter] Transformed schema for ${originalTool.id}:`, JSON.stringify(geminiSafeSchema, null, 2));

    return createTool({
        id: originalTool.id,
        description: originalTool.description,
        inputSchema: geminiSafeSchema,
        outputSchema: originalTool.outputSchema,
        execute: async ({ context }) => {
            // Hydrate context (parse JSON strings back to objects)
            const hydratedContext = hydrateContext(context, originalTool.inputSchema);

            // Execute original tool
            return originalTool.execute({ context: hydratedContext });
        },
    });
}
