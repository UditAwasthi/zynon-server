import SchemaBuilder from "@pothos/core";
import { prisma } from "../../config/prisma";
import { DateTimeResolver } from "graphql-scalars";

export interface GraphQLContext {
  prisma: typeof prisma;
  userId: string | null;
}

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
}>({});

builder.addScalarType("DateTime", DateTimeResolver, {});