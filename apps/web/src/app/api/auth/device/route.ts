import { DeviceAuthRequestSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../../_lib/http";
import { issueDeviceCode } from "../../_lib/state";

export async function POST(request: Request) {
    const body = await readJsonBody(request);
    const parsed = DeviceAuthRequestSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid device auth payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const response = issueDeviceCode(parsed.data);
    return success(response);
}
