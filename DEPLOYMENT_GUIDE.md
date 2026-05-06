# Quick Deployment Guide - Bug Fixes & Audit

## 🚀 What Changed

### Fixed Issues
1. ✅ **Section labels showing keys** ("IR_DEPT" instead of "Industrial Relations")
2. ✅ **Email sending failures** - now logs detailed SMTP diagnostics
3. ✅ **No system health monitoring** - added comprehensive health check endpoint
4. ✅ **Role assignment opacity** - improved validation and reporting

### Files Changed (3 files + 1 new diagnostic endpoint)
```
app/clearance/[id]/page.tsx                  (2 lines: use section.label)
lib/notifications.ts                         (30 lines: enhanced error logging)
COMPREHENSIVE_AUDIT_REPORT.md                (NEW: detailed audit & troubleshooting)
app/api/debug/system-health/route.ts         (NEW: health check endpoint)
```

---

## 📋 Deployment Steps

**On Server:**

```bash
# Pull latest code
git pull

# Verify build passes
npm run build

# Restart application
npm run start  # or your deployment restart command
```

**Expected build output:**
```
✓ Compiled successfully (no errors)
```

---

## ✅ Testing Checklist After Deployment

### 1. Section Labels Fixed
```
✅ Login to portal
✅ Create/view a clearance
✅ Check section tabs show custom names (e.g., "Industrial Relations") NOT keys (IR_DEPT)
```

### 2. System Health Check
```bash
# Test the new health check endpoint (SUPER_ADMIN only)
curl "http://your-server/api/debug/system-health"

# Should show overall status: HEALTHY or WARNING (not DEGRADED)
# Check each subsystem status
```

### 3. Email Diagnostics
```bash
# If emails weren't working before:
curl "http://your-server/api/debug/system-health" | grep -A 20 '"smtp"'

# Look for:
# - status: "OK" → SMTP is properly configured
# - status: "ERROR" → Details about what's wrong (config missing, connection failed, etc.)
```

### 4. Approver Assignment Validation
```bash
# Verify all sections have approvers assigned
curl "http://your-server/api/admin/approvers?company=1200" \
  -H "Authorization: Bearer <super-admin-token>"

# Check each section shows an approver assigned
```

---

## 🔍 Troubleshooting Deployment

### Build Failures
If `npm run build` fails:
- Run `npm install` to ensure all dependencies installed
- Check Node.js version matches requirements (v18+ recommended)
- Clear cache: `rm -rf .next node_modules && npm install && npm run build`

### Emails Still Not Working After Deployment
1. Run health check: `curl http://your-server/api/debug/system-health`
2. Check smtp section for detailed error
3. Verify SMTP_* env vars in .env.local on server
4. Check firewall allows outbound SMTP to your mail server

### Section Labels Still Showing Keys
- Likely cache issue - do hard refresh in browser (Ctrl+Shift+R or Cmd+Shift+R)
- Or clear browser cache and try again
- Verify API response includes label field:
  ```bash
  curl "http://your-server/api/clearance/<id>" | jq '.sections[0].label'
  ```

---

## 📊 New Diagnostic Tools Available

### `/api/debug/system-health` (NEW)
Comprehensive health check showing:
- Database connectivity ✓
- SMTP configuration & connection ✓
- User roles and assignments ✓
- Section templates ✓
- Authorization model integrity ✓

### `/api/debug/approvers?clearanceId=<id>` (Existing)
Detailed breakdown of a specific clearance's approval state

### `/api/admin/approvers/validate-and-fix?company=1200` (Existing)
Identify and auto-fix common issues

---

## 📖 Documentation

Read these for full details:
- **[COMPREHENSIVE_AUDIT_REPORT.md](./COMPREHENSIVE_AUDIT_REPORT.md)** - Complete audit with issue details and solutions
- **[APPROVER_TROUBLESHOOTING.md](./APPROVER_TROUBLESHOOTING.md)** - Approver-specific issues and fixes

---

## 🆘 Still Need Help?

1. Check health endpoint: `curl http://server/api/debug/system-health`
2. Review logs: `[notifications] sendEmail`, `[clearance]` errors
3. Refer to COMPREHENSIVE_AUDIT_REPORT.md troubleshooting section
4. Run admin diagnostic: `/api/admin/approvers/validate-and-fix?company=1200`

---

## 📝 Notes

- Health check endpoint is SUPER_ADMIN only for security
- Email validation now happens before sending (prevents silent failures)
- Section labels now dynamically use database-configured names
- All changes are backward compatible - no data migrations needed
