# Security Policy

## Supported Versions

The following table shows the currently supported versions of Formworks:

| Version | Status | Support Level |
|---------|--------|---------------|
| 1.0.0-alpha | Current | Supported |
| < 1.0.0 | Deprecated | Not Supported |

## Reporting Vulnerabilities

The Formworks team takes security very seriously. If you discover a security vulnerability in Formworks, please report it responsibly by following these steps:

1. **Do not** publicly disclose the vulnerability on GitHub issues, discussions, or any public forum
2. Report the vulnerability using GitHub's **private vulnerability disclosure feature**:
   - Navigate to https://github.com/formwork-carpentry/formworks/security/advisories/new
   - Provide detailed information about the vulnerability

### Expected Response Times

- **Acknowledgment**: We will acknowledge your vulnerability report within **48 hours**
- **Patch Release**:
  - **Critical** vulnerabilities: Patched within **7 days**
  - **High/Medium/Low** vulnerabilities: Patched within **30 days**
- **Disclosure**: We will coordinate the public disclosure timing with you to ensure adequate time for users to upgrade

## Out of Scope

The following security issues are **out of scope** for our vulnerability disclosure program:

- Denial of Service (DoS) attacks
- Social engineering or phishing attacks
- Vulnerabilities in third-party dependencies (unless specifically related to our unique usage pattern)
- Issues in the underlying runtime (Node.js, npm, etc.)
- Infrastructure or deployment-related issues
- Issues that require user interaction with untrusted files

## Security Best Practices

When using Formworks, we recommend:

1. Keep your Node.js version up to date
2. Regularly update Formworks and its dependencies
3. Review the `package-lock.json` regularly for security updates
4. Use npm audit to check for known vulnerabilities: `npm audit`
5. Enable 2FA on your npm account if publishing packages

## Contact

For security-related inquiries, contact: conduct@formwork-carpentry.dev

Thank you for helping keep Formworks secure!
