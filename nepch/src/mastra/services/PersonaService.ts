import { db } from '../db';

export interface Persona {
    id: string;
    name?: string;
    attributes?: any;
    current_concerns?: any;
    last_seen?: string;
    summary?: string;
}

export class PersonaService {
    async getPersona(userId: string): Promise<Persona | null> {
        const result = await db.execute({
            sql: 'SELECT * FROM villagers WHERE id = ?',
            args: [userId],
        });

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id as string,
            name: row.name as string,
            attributes: row.attributes ? JSON.parse(row.attributes as string) : {},
            current_concerns: row.current_concerns ? JSON.parse(row.current_concerns as string) : {},
            last_seen: row.last_seen as string,
            summary: row.summary as string,
        };
    }

    async savePersona(persona: Persona): Promise<void> {
        const existing = await this.getPersona(persona.id);

        if (existing) {
            await db.execute({
                sql: `
          UPDATE villagers 
          SET name = ?, attributes = ?, current_concerns = ?, last_seen = ?, summary = ?
          WHERE id = ?
        `,
                args: [
                    persona.name || existing.name || null,
                    JSON.stringify(persona.attributes || existing.attributes || {}),
                    JSON.stringify(persona.current_concerns || existing.current_concerns || {}),
                    persona.last_seen || new Date().toISOString(),
                    persona.summary || existing.summary || null,
                    persona.id
                ],
            });
        } else {
            await db.execute({
                sql: `
          INSERT INTO villagers (id, name, attributes, current_concerns, last_seen, summary)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
                args: [
                    persona.id,
                    persona.name || null,
                    JSON.stringify(persona.attributes || {}),
                    JSON.stringify(persona.current_concerns || {}),
                    persona.last_seen || new Date().toISOString(),
                    persona.summary || null
                ],
            });
        }
    }
    async searchPersonas(query: string): Promise<Persona[]> {
        const result = await db.execute({
            sql: `
                SELECT * FROM villagers 
                WHERE name LIKE ? 
                OR attributes LIKE ? 
                OR current_concerns LIKE ? 
                OR summary LIKE ?
                LIMIT 5
            `,
            args: [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`],
        });

        return result.rows.map(row => ({
            id: row.id as string,
            name: row.name as string,
            attributes: row.attributes ? JSON.parse(row.attributes as string) : {},
            current_concerns: row.current_concerns ? JSON.parse(row.current_concerns as string) : {},
            last_seen: row.last_seen as string,
            summary: row.summary as string,
        }));
    }
}
