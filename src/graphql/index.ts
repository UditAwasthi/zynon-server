import "./schema/user";
import "./schema/auth";

import { builder } from "./schema/builder";

builder.queryType({
  fields: (t) => ({
    health: t.string({
      resolve: () => "ok",
    }),
  }),
});

builder.mutationType({});

export const schema = builder.toSchema({});