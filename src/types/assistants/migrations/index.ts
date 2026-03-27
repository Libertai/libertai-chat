import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type MigrationFunction<TInput = any, TOutput = any> = (persistedState: TInput) => TOutput;

export interface Migration<TInput = any, TOutput = any> {
	fromVersion: number;
	toVersion: number;
	inputSchema: z.ZodSchema<TInput>;
	outputSchema: z.ZodSchema<TOutput>;
	migrate: MigrationFunction<TInput, TOutput>;
}

/**
 * List of all assistant store migrations
 * Add new migrations to this array as the schema evolves
 */
const migrations: Migration[] = [];

/**
 * Runs all necessary migrations to bring persisted state up to current version
 * @param persistedState - The state loaded from localStorage
 * @param currentVersion - The current schema version
 * @returns The migrated state
 */
export const runMigrations = (persistedState: any, currentVersion: number): any => {
	if (!persistedState) {
		return { customAssistants: [], selectedAssistant: "6984ea23-1c6c-402e-adf0-1afddceec404" };
	}

	let state = persistedState;

	// Run migrations sequentially
	for (const migration of migrations) {
		if (currentVersion < migration.toVersion) {
			try {
				console.log(`Running assistant migration v${migration.fromVersion} -> v${migration.toVersion}`);

				// Validate input if possible
				const validatedInput = migration.inputSchema.safeParse(state);
				if (validatedInput.success) {
					state = migration.migrate(validatedInput.data);
				} else {
					console.warn(
						`Assistant migration v${migration.toVersion} input validation failed, proceeding anyway`,
					);
					state = migration.migrate(state);
				}

				// Validate output
				const validatedOutput = migration.outputSchema.safeParse(state);
				if (!validatedOutput.success) {
					console.error(
						`Assistant migration v${migration.toVersion} output validation failed:`,
						validatedOutput.error,
					);
					throw new Error(`Assistant migration v${migration.toVersion} produced invalid output`);
				}

				state = validatedOutput.data;
			} catch (error) {
				console.error(`Assistant migration v${migration.toVersion} failed:`, error);
				break;
			}
		}
	}

	return state;
};
