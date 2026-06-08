import SchemaBuilder from "@pothos/core";
import { prisma } from "../../config/prisma";

export interface GraphQLContext {
  prisma: typeof prisma;
  userId: string | null;
}

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
}>({});