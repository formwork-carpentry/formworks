/**
 * @module @carpentry/sociallock/providers
 * @description Built-in OAuth provider configuration factories.
 */

import type { OAuthProviderConfig } from "../contracts.js";

export type BuiltInProvider = "google" | "github" | "facebook" | "microsoft";

export function googleProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  scopes: string[] = ["email", "profile", "openid"],
): OAuthProviderConfig {
  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    authStyle: "body",
  };
}

export function githubProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  scopes: string[] = ["user:email"],
): OAuthProviderConfig {
  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    authStyle: "header",
  };
}

export function microsoftProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  scopes: string[] = ["openid", "profile", "email"],
  tenant = "common",
): OAuthProviderConfig {
  const base = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authUrl: `${base}/authorize`,
    tokenUrl: `${base}/token`,
    profileUrl: "https://graph.microsoft.com/v1.0/me",
    authStyle: "body",
  };
}

export function facebookProvider(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  scopes: string[] = ["email", "public_profile"],
): OAuthProviderConfig {
  const version = "v21.0";

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
    authUrl: `https://www.facebook.com/${version}/dialog/oauth`,
    tokenUrl: `https://graph.facebook.com/${version}/oauth/access_token`,
    profileUrl: `https://graph.facebook.com/${version}/me?fields=id,name,email,picture`,
    authStyle: "body",
  };
}
