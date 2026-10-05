import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";
import { ServerConfigurationError } from "@/lib/env";

function createHandler(method: "GET" | "POST") {
  return async (request: Request) => {
    try {
      return toNextJsHandler(getAuth())[method](request);
    } catch (error) {
      if (error instanceof ServerConfigurationError) {
        return Response.json(
          { message: "DEETA todavía no tiene configurada la base de datos." },
          { status: 503 },
        );
      }
      throw error;
    }
  };
}

export const GET = createHandler("GET");
export const POST = createHandler("POST");
