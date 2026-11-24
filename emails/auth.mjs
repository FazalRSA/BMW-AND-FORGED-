/**
 * Supabase Auth emails (admin invite, password reset, and the rest), in the same layout.
 * Customers sign in with Google and never see these; admins do. The placeholders are Supabase's Go
 * template variables and are left in the output for Supabase to fill.
 */
import { EMAIL } from './config.mjs';

const URL_VAR = '{{ .ConfirmationURL }}';
const why = (what) => `You are receiving this because ${what}. If that was not you, you can ignore this email and nothing will change.`;

export const AUTH_EMAILS = {
  confirmation: {
    subject: 'Confirm your email address',
    doc: { preheader: 'One tap to confirm your address.', kicker: 'Account', title: 'Confirm your email.', reason: why('someone used this address to create a FORGEDSA account'), blocks: [{ t: 'p', text: 'Confirm that this address is yours to finish setting up your account.' }, { t: 'buttons', items: [{ label: 'Confirm my email', href: URL_VAR, kind: 'primary' }] }] }
  },
  invite: {
    subject: 'You have been invited to FORGEDSA',
    doc: { preheader: 'Accept the invitation and set your password.', kicker: 'Invitation', title: 'You are invited.', reason: why('you were invited to manage FORGEDSA'), blocks: [{ t: 'p', text: 'You have been invited to the FORGEDSA admin. Accept the invitation to choose your password and sign in.' }, { t: 'buttons', items: [{ label: 'Accept the invitation', href: URL_VAR, kind: 'primary' }] }] }
  },
  magic_link: {
    subject: 'Your FORGEDSA sign-in link',
    doc: { preheader: 'Your one-time sign-in link.', kicker: 'Sign in', title: 'Your sign-in link.', reason: why('a sign-in link was requested for this address'), blocks: [{ t: 'p', text: 'Use the button to sign in. The link works once and expires soon.' }, { t: 'buttons', items: [{ label: 'Sign in', href: URL_VAR, kind: 'primary' }] }] }
  },
  recovery: {
    subject: 'Reset your FORGEDSA password',
    doc: { preheader: 'Choose a new password.', kicker: 'Password', title: 'Reset your password.', reason: why('a password reset was requested for this address'), blocks: [{ t: 'p', text: 'Use the button to choose a new password. The link works once and expires soon.' }, { t: 'buttons', items: [{ label: 'Choose a new password', href: URL_VAR, kind: 'primary' }] }, { t: 'note', text: 'We will never ask for your password by email or WhatsApp.' }] }
  },
  email_change: {
    subject: 'Confirm your new email address',
    doc: { preheader: 'Confirm the change of address.', kicker: 'Account', title: 'Confirm your new email.', reason: why('a change of email address was requested on your account'), blocks: [{ t: 'p', text: 'Confirm that you want to change the email on your account from {{ .Email }} to {{ .NewEmail }}.' }, { t: 'buttons', items: [{ label: 'Confirm the change', href: URL_VAR, kind: 'primary' }] }] }
  },
  reauthentication: {
    subject: 'Your FORGEDSA confirmation code',
    doc: { preheader: 'Your one-time code.', kicker: 'Security', title: 'Confirm it is you.', reason: why('a sensitive change was started on your account'), blocks: [{ t: 'p', text: 'Enter this code to continue. It expires soon, and we will never ask you to read it out to anyone.' }, { t: 'code', text: '{{ .Token }}' }] }
  }
};
export const AUTH_FROM = `${EMAIL.fromName} <${EMAIL.fromEmail}>`;
