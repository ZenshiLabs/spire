import { failure, readJsonBody, success } from "../../_lib/http";
import { exchangeDeviceCode } from "../../_lib/state";

export async function POST(request: Request) {
    const body = await readJsonBody(request);

    const deviceCode =
        body && typeof body === "object" && "deviceCode" in body
            ? body.deviceCode
            : undefined;

    if (typeof deviceCode !== "string" || deviceCode.length === 0) {
        return failure("invalid_request", "deviceCode is required.", 400);
    }

    const result = exchangeDeviceCode(deviceCode);

    if (!result.ok) {
        if (result.code === "authorization_pending") {
            return failure("authorization_pending", "Authorization still pending.", 400);
        }

        if (result.code === "expired_token") {
            return failure("expired_token", "Device code has expired.", 400);
        }

        return failure("invalid_device_code", "Unknown device code.", 404);
    }

    return success(result.data);
}
