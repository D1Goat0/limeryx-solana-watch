import { createMembershipHandler } from "../../src/lib/membership-handler.server";
import { membershipServices } from "../../src/lib/membership-store.server";

export default createMembershipHandler(membershipServices);
