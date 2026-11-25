import { runtimeEnv } from './runtimeEnv';

// The product name shown to users: the login panel, the passkey label in the OS
// picker, and the account page. It is defined once, so a rebrand is one edit.
export const APP_NAME = "It's a Plan";

// The product site. The product mark on the public share pages links to it.
export const APP_SITE_URL = 'https://itsaplan.dev/';

// The gallery of project templates that workspaces publish.
export const TEMPLATE_GALLERY_URL = 'https://itsaplan.dev/templates';

// The rules a template published to the gallery at itsaplan.dev must follow.
export const TEMPLATE_GALLERY_RULES_URL = 'https://itsaplan.dev/terms#template-gallery';

// The account on the product site, where a company asks to be listed as a user.
export const SHOWCASE_URL = 'https://itsaplan.dev/account/showcase';

// The legal document URLs, linked from the logged-out screens: Google requires the
// privacy policy and terms registered for the OAuth client to be reachable before
// consent is given. Each instance points these at its own documents through its
// environment (see runtimeEnv); when unset, the legal notice is hidden.
export const PRIVACY_POLICY_URL = runtimeEnv().privacyUrl;
export const TERMS_URL = runtimeEnv().termsUrl;
