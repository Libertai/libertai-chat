import { z } from "zod";
import { v1ToV2Migration } from "./v2.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type MigrationFunction<TInput = any, TOutput = any> = (persistedState: TInput) => TOutput;

export interface Migration<TInput = any, TOutput = any> {
	fromVersion: number;
	toVersion: number;
	inputSchema: z.ZodSchema<TInput>;
	outputSchema: z.ZodSchema<TOutput>;
	migrate: MigrationFunction<TInput, TOutput>;
}

const migrations: Migration[] = [
	v1ToV2Migration,
	// Add future migrations here:
	// v3Migration,
];

export const runMigrations = (persistedState: any, currentVersion: number): any => {
	if (!persistedState) {
		return { chats: {} };
	}

	let state = persistedState;

	// Run migrations sequentially
	for (const migration of migrations) {
		if (currentVersion < migration.toVersion) {
			try {
				console.log(`Running migration v${migration.fromVersion} -> v${migration.toVersion}`);

				// Validate input if possible
				const validatedInput = migration.inputSchema.safeParse(state);
				if (validatedInput.success) {
					state = migration.migrate(validatedInput.data);
				} else {
					console.warn(`Migration v${migration.toVersion} input validation failed, proceeding anyway`);
					state = migration.migrate(state);
				}

				// Validate output
				const validatedOutput = migration.outputSchema.safeParse(state);
				if (!validatedOutput.success) {
					console.error(`Migration v${migration.toVersion} output validation failed:`, validatedOutput.error);
					throw new Error(`Migration v${migration.toVersion} produced invalid output`);
				}

				state = validatedOutput.data;
			} catch (error) {
				console.error(`Migration v${migration.toVersion} failed:`, error);
				break;
			}
		}
	}

	return state;
};
