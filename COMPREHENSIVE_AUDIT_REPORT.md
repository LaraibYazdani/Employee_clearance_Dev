# Employee Clearance Portal - Complete System Audit & Fixes (May 6, 2026)

## Issues Identified and Fixed

### 1. ✅ FIXED: Section Labels Showing Keys Instead of Names

**Problem:**
- Clearance form tabs were displaying section keys (e.g., "IR_DEPT") instead of custom section names (e.g., "Industrial Relations Department")
- The API was providing the correct `label` field, but the UI wasn't using it

**Root Cause:**
- `app/clearance/[id]/page.tsx` was calling `getSectionLabel(sec.section_key)` directly
- This was using hardcoded fallback labels instead of the database-configured custom names
- The API response already included `sec.label` with the correct name

**Fix Applied:**
- Updated line 373 in clearance detail page: `{getSectionLabel(sec.section_key)}` → `{sec.label || getSectionLabel(sec.section_key)}`
- Updated line 414 in clearance detail page: Same fix for current section display
- Now uses custom label from database, falls back to hardcoded only if label is missing

**Verification:**
```bash
# Check that section labels are now showing correctly
curl "http://localhost:3000/api/clearance/<clearance-id>" | jq '.sections[0].label'
# Should show "Industrial Relations Department" or custom name, not "IR_DEPT"
```

---

### 2. ✅ FIXED: Email Error Logging and Diagnostics

**Problem:**
- Emails silently failed to send
- No clear indication of why emails weren't being delivered
- Error messages were swallowed in console.error with minimal details

**Root Cause:**
- `sendEmail()` function caught all errors and only logged them minimally
- No SMTP verification before attempting to send
- Missing SMTP configuration was not explicitly reported
- No return value to indicate success/failure

**Fix Applied:**
- Added SMTP configuration validation before sending
- Added `transport.verify()` to test SMTP connection
- Improved error logging with contextual information:
  - SMTP host/port/credentials status
  - Detailed error messages with stack traces
  - Success logging with message ID
- Now logs what went wrong specifically (bad credentials, unreachable server, etc.)

**Verification:**
Check server logs for detailed email diagnostics:
```bash
# Look for logs with pattern:
# [notifications] sendEmail error: Missing SMTP configuration
# [notifications] SMTP verification failed: ...
# [notifications] sendEmail failed: ...
# [notifications] sendEmail success: ...
```

---

### 3. ✅ NEW: System Health Check Endpoint

**Created:** `/api/debug/system-health`

Comprehensive health check that validates:
- Database connectivity
- SMTP configuration and connectivity
- User roles and assignments
- Section templates and approver assignments
- Clearance item status distribution
- Authorization model integrity

**Usage:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/debug/system-health"
```

**Response includes:**
```json
{
  "summary": {
    "overallStatus": "HEALTHY|WARNING|DEGRADED",
    "errors": number,
    "warnings": number
  },
  "checks": {
    "database": { "status": "OK", "userCount": 150, ... },
    "smtp": { "status": "OK", "config": {...}, ... },
    "roles": { "status": "OK", "usersWithDeptRoles": 12, ... },
    "templates": { "status": "OK", "companies": {...}, ... }
  }
}
```

---

## Role Assignment Logic - Deep Dive

**How role assignment works:**

1. **User Created/Updated**: When HRBP creates a clearance request
   - User authenticated via SF HRBP check
   - HRBP role auto-granted if not already present

2. **Approver Assigned** (Admin → Approvers):
   - `POST /api/admin/approvers` called
   - `setApproverForItem()` creates ApproverAssignment record
   - Calls `grantApproverRole()` in parallel
   - `grantApproverRole()` fetches user's current roles and adds DEPT_APPROVER_* role

3. **Approver Revoked** (delete assignment):
   - `removeApproverForItem()` deletes assignment
   - Calls `revokeApproverRoleIfNotAssigned()`
   - Checks if user still has OTHER assignments in same section/company
   - If not, removes the DEPT_APPROVER_* role

**Potential Issues & Solutions:**

| Issue | Detection | Solution |
|-------|-----------|----------|
| Role not granted | `GET /api/admin/approvers` - approver doesn't have role | Re-save assignment (triggers grantApproverRole) |
| Role not revoked | User still has role after all assignments removed | Go to Admin → Users, manually remove role |
| Wrong company assignments | User assigned to multiple companies | Check ApproverAssignment table, must be same company_code |
| Stale JWT roles | User approves then gets new role, but JWT old | Page polls and refreshes every 30 seconds |

---

## Email Delivery Troubleshooting

**Critical checks before testing:**

1. **Verify SMTP Configuration in .env.local:**
```bash
# Must be set (from your .env.local):
SMTP_HOST=welcome1.packages.com.pk
SMTP_PORT=587
SMTP_USER=systems.services@packages.com.pk
SMTP_PASS=\jR|;52##
SMTP_FROM=systems.services@packages.com.pk
```

2. **Test SMTP Connection:**
```bash
curl "http://localhost:3000/api/debug/system-health" | jq '.checks.smtp'
# Should show "status": "OK"
```

3. **Check For These Common Issues:**
- ❌ SMTP_HOST is unreachable → Check firewall/network
- ❌ SMTP_USER/SMTP_PASS wrong → Verify credentials in .env.local
- ❌ SMTP_SECURE set incorrectly → Port 587 should be `false`, port 465 should be `true`
- ❌ Recipient email is bouncing → Check employee email addresses in DB

4. **Trigger a Test Email:**
```bash
# Initiate a new clearance request
# Watch server logs for [notifications] sendEmail success/error messages
```

5. **Check Logs for Detailed Errors:**
- Look for: `[notifications] sendEmail error:` or `[notifications] SMTP verification failed:`
- Extract error message and troubleshoot accordingly

---

## Authorization Logic Validation

**The system enforces:**

1. **Approver Visibility:**
   - Can see clearances from their assigned company ONLY
   - Exception: SUPER_ADMIN sees all
   - Exception: Line managers see their direct reports
   - Exception: HRBP sees clearances they initiated

2. **Section Action Authorization:**
   - User must have `ApproverAssignment` for the section OR have matching DEPT_APPROVER_* role
   - DEPT_HEAD sections: Only line manager can approve
   - If multiple assignees: Only assigned approver can act
   - Live data checked: Not stale section.approver_id column

3. **Item Status Requirements:**
   - ✅ APPROVED: Approver approved it
   - ✅ NA: Not applicable (skip it)
   - ❌ PENDING: Blocks section approval
   - ❌ DENIED/FLAGGED: Section must be re-routed by HRBP

**To test authorization:**
```bash
# As DEPT_APPROVER_IR user, try to approve IT section
curl -X PATCH "http://localhost:3000/api/clearance/<id>/sections/<id>" \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "APPROVE"}'
# Should return: 403 Forbidden (not authorized)
```

---

## Comprehensive Pre-Deployment Checklist

### Database
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Seed data if needed: `npm run seed`
- [ ] Run `npm run build` successfully

### SMTP/Email
- [ ] Verify SMTP credentials in .env.local
- [ ] Test via `/api/debug/system-health` - smtp check passes
- [ ] Send test email manually to verify delivery
- [ ] Check spam folder if email goes missing

### Roles
- [ ] Go to Admin → Approvers
- [ ] Verify all sections have approvers assigned per company
- [ ] Check approvers have DEPT_APPROVER_* roles (can verify via debug endpoint)
- [ ] Test: Non-assigned approver shouldn't see clearances

### Templates
- [ ] Go to Admin → Templates
- [ ] Verify section labels are showing custom names (not keys)
- [ ] Add/remove items as needed
- [ ] Verify clearance form reflects template changes

### Clearance Flow
- [ ] Create a test clearance as HRBP
- [ ] Approver should receive email notification
- [ ] Approver opens clearance and sees correct section names
- [ ] Mark items APPROVED/NA before section approval
- [ ] Approve section - should succeed
- [ ] Verify HRBP receives completion notification

---

## Debug Endpoints Summary

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/debug/approvers?clearanceId=<id>` | Detailed clearance approval breakdown | SUPER_ADMIN |
| `GET /api/debug/system-health` | Full system health report | SUPER_ADMIN |
| `GET /api/admin/approvers/validate-and-fix?company=1200` | Identify & report issues | SUPER_ADMIN |
| `POST /api/admin/approvers/validate-and-fix?company=1200&fixRoles=true` | Auto-grant missing roles | SUPER_ADMIN |
| `POST /api/admin/approvers/validate-and-fix?clearanceId=<id>&autoApprovePending=true` | Auto-approve pending items | SUPER_ADMIN |

---

## Files Changed

| File | Changes |
|------|---------|
| `app/clearance/[id]/page.tsx` | Use section.label from API (2 line fixes) |
| `lib/notifications.ts` | Enhanced email error logging and SMTP verification |
| `app/api/debug/system-health/route.ts` | NEW: Comprehensive health check endpoint |
| `app/api/admin/approvers/validate-and-fix/route.ts` | Fixed in previous commit (import + logic) |

---

## Known Limitations & Future Improvements

### Current Constraints
- Approver can only serve one company - enforced at assignment time
- ApproverAssignment uses company_code, section_key, item_key unique constraint
- Roles are JSON arrays - not ideal for querying but works with current scale

### Recommended Future Work
- [ ] Add email queue/retry logic for failed sends
- [ ] Implement audit logging for all role changes
- [ ] Add bulk approver import via CSV
- [ ] Implement approval workflows with conditional routing
- [ ] Add notification preferences UI for approvers
- [ ] Create approver dashboard showing pending approvals

---

## Support & Troubleshooting

**If emails not being sent:**
1. Run `/api/debug/system-health`
2. Check smtp.status and error details
3. Verify SMTP_* env vars in .env.local
4. Check server logs for `[notifications] sendEmail` messages
5. Test SMTP credentials independently

**If approver can't see clearances:**
1. Run `/api/debug/approvers?clearanceId=<id>`
2. Check assigned_approvers list
3. Verify ApproverAssignment records via `/api/admin/approvers?company=1200`
4. Confirm user has DEPT_APPROVER_* role

**If "action failed" on approval:**
1. Check all items are APPROVED or NA (not PENDING)
2. Verify user is assigned to the section (not just having role)
3. Check section status is PENDING (not LOCKED/COMPLETED)
4. Run system health check to validate role assignments
