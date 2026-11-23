import {
  inferAdditionalFields,
  magicLinkClient,
  twoFactorClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { userFields } from '../../shared/user-fields'

// Same origin as the API, so no baseURL is needed.
export const authClient = createAuthClient({
  // twoFactorClient without options: the sign-in form itself reacts to
  // `twoFactorRedirect` instead of navigating to a separate page.
  plugins: [
    magicLinkClient(),
    twoFactorClient(),
    inferAdditionalFields({ user: userFields }),
  ],
})
