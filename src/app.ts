import express from "express";
import { createYoga } from "graphql-yoga";
import { userService } from "./modules/user/user.service";

async function test() {
  const result =
    await userService.createAvatarUploadUrl(
      "test-user-id",
      "image/jpeg"
    );

  console.log(result);
}

test();
import { schema } from "./graphql";
import { createContext } from "./context";

const app = express();

const yoga = createYoga({
  schema,
  context: async ({ request }) =>
    createContext(request),
  graphqlEndpoint: "/graphql",
});

app.use("/graphql", yoga);

app.get("/", (_, res) => {
  res.json({
    success: true,
    message: "Zynon API Running",
  });
});

export default app;