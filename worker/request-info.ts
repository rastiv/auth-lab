import { describeDevice } from "../shared/device";

/**
 * Where a request came from, as stored in the activity log and shown in
 * emails. Location comes from Cloudflare (request.cf), no GeoIP lookup.
 */
export function describeRequest(request: Request | undefined) {
  const cf = (request as { cf?: IncomingRequestCfProperties } | undefined)?.cf;
  return {
    device: describeDevice(request?.headers.get("user-agent")),
    city: cf?.city ?? null,
    country: cf?.country ?? null,
    network: cf?.asOrganization ?? null,
  };
}
