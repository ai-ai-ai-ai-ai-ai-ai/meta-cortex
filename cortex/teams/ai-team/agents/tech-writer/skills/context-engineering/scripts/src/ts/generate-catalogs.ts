import { Effect } from "effect";
import { CatalogGeneration } from "./catalog-generation.ts";

await Effect.runPromise(CatalogGeneration.shipped().write());
