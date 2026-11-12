<!-- SDE-SECURITY-HARDENING-START -->
## Security Hardening Execution Contract

This repository is a **placeholder scaffold**. Each countermeasure below has a task recipe in
`skills/{domain}/{ID-slug}/SKILL.md` that explains how to implement the related feature from
`../specs/PRD.md` securely. Implement features **by following these recipes**, not the naive
approach the spec implies.

## Project Overview
| Property | Value |
|----------|-------|
| Application | acme-retail-v2 |
| SD Elements Project | [ACME Retail v2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/) |
| Project ID | 35 |
| Business Unit / Application | Afrika & SC - Labs (9) / ACME Retail v2 (22) |
| Risk Policy | On-Boarding Policy (1) |
| Total Countermeasures | 57 (51 file-tracked + 6 PROCESS note-only) |
| Source | Spec files (specs/PRD.md) |
| Stack | Next.js + React + TypeScript, pnpm, Supabase (Postgres, Auth, Storage, Realtime), Vercel |

## Countermeasure Summary by Category

| Category | Count | Description |
|----------|-------|-------------|
| CODE_FIX | 46 | Secure implementation needed in application code |
| INFRA | 5 | External infrastructure (Supabase / Vercel / DNS dashboards) |
| **FILE-TRACKED TOTAL** | **51** | Countermeasures with local skill files |

> **PROCESS countermeasures (6) are noted in SD Elements only and are not tracked locally:** CT1, CT2, T755, T1386, T2128, T2348.

## Skill Files

| Domain | Countermeasures |
|--------|----------------|
| authentication | 5 |
| access-control | 3 |
| database | 5 |
| output-encoding | 4 |
| browser-security | 5 |
| api-security | 7 |
| crypto-secrets | 6 |
| privacy | 7 |
| file-storage | 3 |
| supply-chain-release | 3 |
| logging | 2 |
| email | 1 |

### authentication
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2 | Secure the password reset mechanism | [skills/authentication/T2-secure-password-reset/SKILL.md](./skills/authentication/T2-secure-password-reset/SKILL.md) | 9 | CODE_FIX | Applied |
| T20 | Generate unique session IDs and reset old IDs after authentication | [skills/authentication/T20-regenerate-session-ids/SKILL.md](./skills/authentication/T20-regenerate-session-ids/SKILL.md) | 9 | CODE_FIX | Applied |
| T1539 | Clear browser data on user logout | [skills/authentication/T1539-clear-browser-data-on-logout/SKILL.md](./skills/authentication/T1539-clear-browser-data-on-logout/SKILL.md) | 8 | CODE_FIX | Applied |
| T69 | Strong password requirements for server-to-server system accounts | [skills/authentication/T69-system-account-password-strength/SKILL.md](./skills/authentication/T69-system-account-password-strength/SKILL.md) | 8 | INFRA | Documented |
| T70 | Implement account lockout or authentication throttling for system accounts | [skills/authentication/T70-system-account-lockout-throttling/SKILL.md](./skills/authentication/T70-system-account-lockout-throttling/SKILL.md) | 8 | INFRA | Documented |

### access-control
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T17 | Do not only rely on client-side authorization | [skills/access-control/T17-server-side-authorization/SKILL.md](./skills/access-control/T17-server-side-authorization/SKILL.md) | 8 | CODE_FIX | Applied |
| T338 | Control access to resources through user authentication and authorization | [skills/access-control/T338-authn-authz-access-control/SKILL.md](./skills/access-control/T338-authn-authz-access-control/SKILL.md) | 7 | CODE_FIX | Applied |
| T378 | Authorize every request for data objects | [skills/access-control/T378-authorize-every-data-object-request/SKILL.md](./skills/access-control/T378-authorize-every-data-object-request/SKILL.md) | 8 | CODE_FIX | Applied |

### database
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T19 | Restrict Application's Access to Database | [skills/database/T19-restrict-app-database-access/SKILL.md](./skills/database/T19-restrict-app-database-access/SKILL.md) | 8 | CODE_FIX | Applied |
| T38 | Bind variables in SQL statements | [skills/database/T38-bind-sql-variables/SKILL.md](./skills/database/T38-bind-sql-variables/SKILL.md) | 10 | CODE_FIX | Applied |
| T2598 | Implement query-level access control | [skills/database/T2598-query-level-access-control/SKILL.md](./skills/database/T2598-query-level-access-control/SKILL.md) | 8 | CODE_FIX | Applied |
| T2599 | Protect against connection string parameter pollution | [skills/database/T2599-connection-string-parameter-pollution/SKILL.md](./skills/database/T2599-connection-string-parameter-pollution/SKILL.md) | 9 | CODE_FIX | Applied |
| T2600 | Control the result set size returned by a query | [skills/database/T2600-limit-query-result-size/SKILL.md](./skills/database/T2600-limit-query-result-size/SKILL.md) | 7 | CODE_FIX | Applied |

### output-encoding
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T36 | Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript | [skills/output-encoding/T36-escape-untrusted-output/SKILL.md](./skills/output-encoding/T36-escape-untrusted-output/SKILL.md) | 8 | CODE_FIX | Applied |
| T37 | Avoid DOM-based Cross-Site Scripting (XSS) | [skills/output-encoding/T37-avoid-dom-xss/SKILL.md](./skills/output-encoding/T37-avoid-dom-xss/SKILL.md) | 8 | CODE_FIX | Applied |
| T42 | Avoid relying on untrusted data for server-side selection | [skills/output-encoding/T42-no-untrusted-server-side-selection/SKILL.md](./skills/output-encoding/T42-no-untrusted-server-side-selection/SKILL.md) | 10 | CODE_FIX | Applied |
| T1144 | Prevent Server-Side Template Injection (SSTI) | [skills/output-encoding/T1144-prevent-ssti/SKILL.md](./skills/output-encoding/T1144-prevent-ssti/SKILL.md) | 8 | CODE_FIX | Applied |

### browser-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T21 | Ensure all data in transit is encrypted using a secure TLS channel | [skills/browser-security/T21-encrypt-data-in-transit-tls/SKILL.md](./skills/browser-security/T21-encrypt-data-in-transit-tls/SKILL.md) | 8 | CODE_FIX | Applied |
| T29 | Use anti-Cross-Site Request Forgery (CSRF) tokens | [skills/browser-security/T29-anti-csrf-tokens/SKILL.md](./skills/browser-security/T29-anti-csrf-tokens/SKILL.md) | 7 | CODE_FIX | Applied |
| T66 | Prevent web pages from being loaded inside iFrame | [skills/browser-security/T66-prevent-iframe-loading/SKILL.md](./skills/browser-security/T66-prevent-iframe-loading/SKILL.md) | 7 | CODE_FIX | Applied |
| T257 | Secure cross origin resource sharing (CORS) | [skills/browser-security/T257-secure-cors/SKILL.md](./skills/browser-security/T257-secure-cors/SKILL.md) | 8 | CODE_FIX | Applied |
| T1468 | Encrypt sensitive data at rest in the browser | [skills/browser-security/T1468-encrypt-browser-data-at-rest/SKILL.md](./skills/browser-security/T1468-encrypt-browser-data-at-rest/SKILL.md) | 9 | CODE_FIX | Applied |

### api-security
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T35 | Fine-tune HTTP server settings | [skills/api-security/T35-fine-tune-http-server-settings/SKILL.md](./skills/api-security/T35-fine-tune-http-server-settings/SKILL.md) | 9 | CODE_FIX | Applied |
| T166 | Protect against JSON hijacking | [skills/api-security/T166-protect-against-json-hijacking/SKILL.md](./skills/api-security/T166-protect-against-json-hijacking/SKILL.md) | 7 | CODE_FIX | Applied |
| T374 | Offload HTTP request handling to dedicated modules | [skills/api-security/T374-offload-http-request-handling/SKILL.md](./skills/api-security/T374-offload-http-request-handling/SKILL.md) | 7 | INFRA | Documented |
| T536 | Restrict the size of incoming messages in services | [skills/api-security/T536-restrict-incoming-message-size/SKILL.md](./skills/api-security/T536-restrict-incoming-message-size/SKILL.md) | 8 | CODE_FIX | Applied |
| T1362 | Perform message throttling in Web APIs | [skills/api-security/T1362-api-message-throttling/SKILL.md](./skills/api-security/T1362-api-message-throttling/SKILL.md) | 8 | CODE_FIX | Applied |
| T1365 | Mitigate Server Side Request Forgery | [skills/api-security/T1365-mitigate-ssrf/SKILL.md](./skills/api-security/T1365-mitigate-ssrf/SKILL.md) | 8 | CODE_FIX | Applied |
| T2139 | Prevent information exposure through APIs | [skills/api-security/T2139-prevent-api-information-exposure/SKILL.md](./skills/api-security/T2139-prevent-api-information-exposure/SKILL.md) | 7 | CODE_FIX | Applied |

### crypto-secrets
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T59 | Use standard libraries for cryptography | [skills/crypto-secrets/T59-standard-crypto-libraries/SKILL.md](./skills/crypto-secrets/T59-standard-crypto-libraries/SKILL.md) | 8 | CODE_FIX | Applied |
| T60 | Use correct and approved cryptographic algorithms, parameters, and key lengths | [skills/crypto-secrets/T60-approved-crypto-algorithms/SKILL.md](./skills/crypto-secrets/T60-approved-crypto-algorithms/SKILL.md) | 8 | CODE_FIX | Applied |
| T76 | Do not hardcode passwords | [skills/crypto-secrets/T76-no-hardcoded-secrets/SKILL.md](./skills/crypto-secrets/T76-no-hardcoded-secrets/SKILL.md) | 10 | CODE_FIX | Applied |
| T151 | Use cryptographically secure random numbers | [skills/crypto-secrets/T151-secure-random-numbers/SKILL.md](./skills/crypto-secrets/T151-secure-random-numbers/SKILL.md) | 7 | CODE_FIX | Applied |
| T156 | Validate certificate and its chain of trust properly | [skills/crypto-secrets/T156-validate-certificate-chain/SKILL.md](./skills/crypto-secrets/T156-validate-certificate-chain/SKILL.md) | 7 | CODE_FIX | Applied |
| T558 | Authenticate all other components before any network communication with them | [skills/crypto-secrets/T558-authenticate-network-components/SKILL.md](./skills/crypto-secrets/T558-authenticate-network-components/SKILL.md) | 9 | CODE_FIX | Applied |

### privacy
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T178 | Obtain consent from users prior to collecting personal information | [skills/privacy/T178-consent-before-collecting-pii/SKILL.md](./skills/privacy/T178-consent-before-collecting-pii/SKILL.md) | 10 | CODE_FIX | Applied |
| T544 | Anonymize (de-identify) identifying information before using it for a secondary purpose | [skills/privacy/T544-anonymize-pii-secondary-use/SKILL.md](./skills/privacy/T544-anonymize-pii-secondary-use/SKILL.md) | 8 | CODE_FIX | Applied |
| T604 | Implement a consent withdrawal mechanism | [skills/privacy/T604-consent-withdrawal/SKILL.md](./skills/privacy/T604-consent-withdrawal/SKILL.md) | 10 | CODE_FIX | Applied |
| T742 | Implement technical measures to ensure the accuracy of personal information | [skills/privacy/T742-personal-info-accuracy/SKILL.md](./skills/privacy/T742-personal-info-accuracy/SKILL.md) | 7 | CODE_FIX | Applied |
| T744 | Protect pseudonymized personal information | [skills/privacy/T744-protect-pseudonymized-data/SKILL.md](./skills/privacy/T744-protect-pseudonymized-data/SKILL.md) | 8 | CODE_FIX | Applied |
| T754 | Enable the restriction of processing personal information of an individual for a specific purpose | [skills/privacy/T754-restrict-processing-of-pii/SKILL.md](./skills/privacy/T754-restrict-processing-of-pii/SKILL.md) | 8 | CODE_FIX | Applied |
| T2170 | Ensure that personal information processed by the application meets data localization requirements | [skills/privacy/T2170-data-localization/SKILL.md](./skills/privacy/T2170-data-localization/SKILL.md) | 9 | INFRA | Documented |

### file-storage
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T50 | Use indirect object reference maps if accessing files | [skills/file-storage/T50-indirect-file-references/SKILL.md](./skills/file-storage/T50-indirect-file-references/SKILL.md) | 8 | CODE_FIX | Applied |
| T214 | Protect confidential files on operating system or server | [skills/file-storage/T214-protect-confidential-files/SKILL.md](./skills/file-storage/T214-protect-confidential-files/SKILL.md) | 9 | CODE_FIX | Applied |
| T295 | Avoid storing unencrypted confidential data without access control mechanisms | [skills/file-storage/T295-no-unencrypted-confidential-data-without-acl/SKILL.md](./skills/file-storage/T295-no-unencrypted-confidential-data-without-acl/SKILL.md) | 7 | CODE_FIX | Applied |

### supply-chain-release
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T49 | Disable and remove debug capabilities and code/data, and prepare application for release | [skills/supply-chain-release/T49-disable-debug-for-release/SKILL.md](./skills/supply-chain-release/T49-disable-debug-for-release/SKILL.md) | 7 | CODE_FIX | Applied |
| T186 | Use recommended settings and the latest patches for third party libraries and software | [skills/supply-chain-release/T186-patch-third-party-libraries/SKILL.md](./skills/supply-chain-release/T186-patch-third-party-libraries/SKILL.md) | 10 | CODE_FIX | Applied |
| T279 | Avoid dynamically loading any code without proper security considerations | [skills/supply-chain-release/T279-safe-dynamic-code-loading/SKILL.md](./skills/supply-chain-release/T279-safe-dynamic-code-loading/SKILL.md) | 8 | CODE_FIX | Applied |

### logging
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T349 | Protect audit information and logs against unauthorized access | [skills/logging/T349-protect-audit-logs/SKILL.md](./skills/logging/T349-protect-audit-logs/SKILL.md) | 7 | CODE_FIX | Applied |
| T2602 | Log typical database and server activities and related metadata | [skills/logging/T2602-log-database-and-server-activity/SKILL.md](./skills/logging/T2602-log-database-and-server-activity/SKILL.md) | 8 | CODE_FIX | Applied |

### email
| ID | Title | Skill File | Priority | Category | Status |
|----|-------|-----------|----------|----------|--------|
| T2157 | Secure email and messaging in web applications | [skills/email/T2157-secure-email-messaging/SKILL.md](./skills/email/T2157-secure-email-messaging/SKILL.md) | 7 | INFRA | Documented |

## Completion Requirements

**All 51 file-tracked countermeasures must be addressed. No exceptions.**

## Progress Tracking

| Domain | Total | Implemented | Documented | Remaining |
|--------|-------|-------------|------------|-----------|
| authentication | 5 | 3 | 2 | 0 |
| access-control | 3 | 3 | 0 | 0 |
| database | 5 | 5 | 0 | 0 |
| output-encoding | 4 | 4 | 0 | 0 |
| browser-security | 5 | 5 | 0 | 0 |
| api-security | 7 | 6 | 1 | 0 |
| crypto-secrets | 6 | 6 | 0 | 0 |
| privacy | 7 | 6 | 1 | 0 |
| file-storage | 3 | 3 | 0 | 0 |
| supply-chain-release | 3 | 3 | 0 | 0 |
| logging | 2 | 2 | 0 | 0 |
| email | 1 | 0 | 1 | 0 |
| **TOTAL** | **51** | **46** | **5** | **0** |

**Remaining MUST reach 0 before completion.**

## Verification Checklist

- [ ] All 46 CODE_FIX countermeasures have secure implementations
- [ ] All 5 INFRA items are documented with justification (done) and handed to the platform owner
- [ ] Total addressed = 51
<!-- SDE-SECURITY-HARDENING-END -->
