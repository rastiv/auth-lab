// Our own columns on Better-Auth's user table. Shared so the client knows
// their types (inferAdditionalFields) without importing the server config.
export const userFields = {
  // Email me about sign-ins from a new browser. Each user can change it
  // with authClient.updateUser.
  newDeviceAlerts: { type: 'boolean', defaultValue: true, required: false, input: true },
} as const
