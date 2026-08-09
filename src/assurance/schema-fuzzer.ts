export type PropertySchema = Readonly<{
  type: "string" | "number" | "boolean" | "object" | "array";
  minimum?: number;
  maximum?: number;
}>;

export type SchemaDefinition = Readonly<{
  type: "object";
  required?: readonly string[];
  properties?: Readonly<Record<string, PropertySchema>>;
}>;

export type FuzzOptions = Readonly<{
  seed?: number;
  count?: number;
}>;

export type FuzzContractOptions = Readonly<{
  iterations?: number;
  seed?: number;
}>;

export type FuzzResult = Readonly<{
  totalIterations: number;
  validCount: number;
  invalidHandledCount: number;
  unhandledErrors: readonly string[];
}>;

export class SchemaContractFuzzer {
  private readonly schema: SchemaDefinition;

  constructor(schema: SchemaDefinition) {
    if (!schema || schema.type !== "object") {
      throw new Error("Schema must be an object type schema definition");
    }
    this.schema = schema;
  }

  public generateValidPayloads(options: FuzzOptions = {}): Record<string, unknown>[] {
    const count = options.count ?? 5;
    const seed = options.seed ?? 1;
    const results: Record<string, unknown>[] = [];

    for (let i = 0; i < count; i += 1) {
      const payload: Record<string, unknown> = {};
      const required = this.schema.required ?? [];
      const properties = this.schema.properties ?? {};

      for (const key of required) {
        const propSchema = properties[key];
        payload[key] = this.generateValidValue(key, propSchema, seed + i);
      }

      for (const [key, propSchema] of Object.entries(properties)) {
        if (!required.includes(key) && (i + seed) % 2 === 0) {
          payload[key] = this.generateValidValue(key, propSchema, seed + i);
        }
      }

      results.push(payload);
    }

    return results;
  }

  public generateHostilePayloads(options: FuzzOptions = {}): Record<string, unknown>[] {
    const count = options.count ?? 4;
    const seed = options.seed ?? 1;
    const results: Record<string, unknown>[] = [];
    const required = this.schema.required ?? [];
    const properties = this.schema.properties ?? {};

    for (let i = 0; i < count; i += 1) {
      const payload: Record<string, unknown> = {};

      if (i === 0 && required.length > 0) {
        // Mutation 1: Omit required field
        const omitKey = required[0];
        for (const [key, propSchema] of Object.entries(properties)) {
          if (key !== omitKey) {
            payload[key] = this.generateValidValue(key, propSchema, seed + i);
          }
        }
      } else if (i === 1) {
        // Mutation 2: Type mismatch
        for (const [key, propSchema] of Object.entries(properties)) {
          if (propSchema.type === "number") {
            payload[key] = "NOT_A_NUMBER";
          } else {
            payload[key] = 99999;
          }
        }
      } else if (i === 2) {
        // Mutation 3: Numeric bounds violation
        for (const [key, propSchema] of Object.entries(properties)) {
          if (propSchema.type === "number") {
            payload[key] = (propSchema.minimum ?? 0) - 100;
          } else {
            payload[key] = this.generateValidValue(key, propSchema, seed + i);
          }
        }
      } else {
        // Mutation 4: Hostile characters
        for (const key of Object.keys(properties)) {
          payload[key] = "<script>alert(1)</script>'; DROP TABLE users;--";
        }
      }

      results.push(payload);
    }

    return results;
  }

  public fuzzContract(
    handler: (input: unknown) => boolean,
    options: FuzzContractOptions = {}
  ): FuzzResult {
    const iterations = options.iterations ?? 20;
    const seed = options.seed ?? 42;

    let validCount = 0;
    let invalidHandledCount = 0;
    const unhandledErrors: string[] = [];

    const validPayloads = this.generateValidPayloads({ count: Math.floor(iterations / 2), seed });
    const hostilePayloads = this.generateHostilePayloads({ count: Math.ceil(iterations / 2), seed });
    const allPayloads = [...validPayloads, ...hostilePayloads];

    for (const payload of allPayloads) {
      try {
        const ok = handler(payload);
        if (ok) {
          validCount += 1;
        } else {
          invalidHandledCount += 1;
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        unhandledErrors.push(errorMsg);
      }
    }

    return Object.freeze({
      totalIterations: allPayloads.length,
      validCount,
      invalidHandledCount,
      unhandledErrors,
    });
  }

  private generateValidValue(key: string, schema: PropertySchema | undefined, seed: number): unknown {
    if (!schema) return `sample-${key}-${seed}`;

    switch (schema.type) {
      case "string":
        return `${key}-val-${seed}`;
      case "number": {
        const min = schema.minimum ?? 0;
        const max = schema.maximum ?? 100;
        return min + (seed % (max - min + 1));
      }
      case "boolean":
        return seed % 2 === 0;
      default:
        return `default-${seed}`;
    }
  }
}
