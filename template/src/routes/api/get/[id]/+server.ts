import { error } from "@sveltejs/kit";
import { isValidIdentifier } from "@/entities/artifact/lib/identifier-guard";
import { respond, runForgeplan } from "@/shared/server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id ?? "";
  if (!isValidIdentifier(id)) {
    throw error(400, `invalid artifact id: ${id}`);
  }
  return respond(await runForgeplan(["get", id, "--json"]));
};
