import "server-only";
import type { AiScope } from "../context";
import type { Db } from "./_shared";
import { buildParentTools } from "./parent";
import { buildMerchantTools } from "./merchant";
import { buildSchoolTools } from "./school";

export function buildToolsForScope(db: Db, scope: AiScope) {
  switch (scope.personaType) {
    case "parent_ai":
      return buildParentTools(db, scope);
    case "merchant_ai":
      return buildMerchantTools(db, scope);
    case "school_treasury_ai":
      return buildSchoolTools(db, scope);
  }
}

export const MAX_STEPS: Record<AiScope["personaType"], number> = {
  parent_ai: 4,
  merchant_ai: 3,
  school_treasury_ai: 5,
};
