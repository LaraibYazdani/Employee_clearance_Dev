# Approver Visibility & Approval Issues - Troubleshooting Guide

## Problem Summary

You've configured a clearance layout for BSPL and assigned approvers, but:
1. **Some approvers cannot see clearances** they should be able to approve
2. **One approver can see but gets "action failed"** when trying to approve

---

## Root Causes Analysis

### Cause #1: Missing or Incorrect ApproverAssignment Records

**What it is:** The `ApproverAssignment` table links sections/items to approvers for a company.

**How it manifests:**
- Approvers don't see clearances in their dashboard
- Authorization failures when trying to approve

**How to check:**
1. Go to Admin → Approvers in the portal
2. Select company "BSPL"
3. Check if all sections have approvers assigned
4. Look for **empty assignment slots** (red or warning indicators)

**If missing:** You need to assign approvers again. See [How to Fix](#how-to-fix) section.

---

### Cause #2: Missing DEPT_APPROVER_* Roles

**What it is:** Each approver user must have the appropriate `DEPT_APPROVER_*` role to approve sections.

**Roles mapping:**
- IR_DEPT → `DEPT_APPROVER_IR`
- IT_DEPT → `DEPT_APPROVER_IT`
- SUPPLY_MGMT → `DEPT_APPROVER_SUPPLY`
- ICS_DEPT → `DEPT_APPROVER_ICS`
- SECURITY → `DEPT_APPROVER_SECURITY`
- OTHER_FACILITIES → `DEPT_APPROVER_OTHER`
- DEPT_HEAD → `DEPT_APPROVER_HEAD`
- OD_DEPT → `DEPT_APPROVER_OD`
- HR_DEPT → `DEPT_APPROVER_HR`
- FINANCE → `DEPT_APPROVER_FINANCE`

**How it manifests:**
- "Forbidden: You are not authorized to action this section" error
- Appears as "action failed" in UI

**How to check:**
1. Admin → Users
2. Search for each approver
3. Check their "Roles" field
4. Confirm they have the correct DEPT_APPROVER_* role

**If missing:** Contact admin to add the roles manually or use the diagnostic script.

---

### Cause #3: Items Not Marked APPROVED/NA Before Section Approval

**What it is:** Before a section can be approved, ALL its items must be marked as either:
- `APPROVED` (approver approved it)
- `NA` (not applicable - skip it)
- Cannot be left as `PENDING`

**How it manifests:**
- "Cannot approve section - all items must be approved before the section can be approved" error
- Shows as "action failed" in some cases

**How to check:**
1. Go to the specific clearance
2. Open the section
3. Look at each item's status
4. If any item shows "Pending", it cannot be approved

**If found:** Mark items as APPROVED or NA before approving the section.

---

## How to Fix

### Option 1: Manual Fix via Admin Portal (Recommended for one or two clearances)

**Step 1: Check & Re-assign Approvers**
1. Login as SUPER_ADMIN
2. Go to Admin → Approvers
3. Select company "BSPL (1200)"
4. Review all section assignments
5. Re-select approvers for any missing assignments
6. Click "Save"

This will:
- Create/update ApproverAssignment records
- Automatically grant DEPT_APPROVER_* roles to users

**Step 2: Mark Items as Approved**
1. Go to the problematic clearance
2. Click on each section
3. For each item:
   - Click "Approve" or
   - Select "N/A" if not applicable
4. Then approve the section

---

### Option 2: Diagnostic & Bulk Fix (For multiple clearances)

**Prerequisites:**
- You need Node.js access to the project
- You need SUPER_ADMIN credentials

**Step 1: Run Diagnostics**
```bash
cd d:\Packages\Employee_Clearance_Portal
npm install -D ts-node

# Run diagnostic script
npx ts-node -P tsconfig.json scripts/diagnose-approvers.ts
```

This will show:
- All clearances with issues
- Missing item approvals
- Missing role assignments
- Current ApproverAssignment configuration

**Step 2: Call the Debug Endpoint**
```bash
# Example: Check a specific clearance
curl "http://localhost:3000/api/debug/approvers?clearanceId=<CLEARANCE_ID>&company=1200"
```

Returns JSON showing:
- All sections and their item statuses
- Which approvers are assigned
- What authorization issues exist

**Step 3: Apply Fixes**

The diagnostic script provides these functions (call from Node REPL):

```typescript
// Fix 1: Grant missing DEPT_APPROVER roles to users
await fixMissingRoles()

// Fix 2: Mark all pending items as N/A (so sections can be approved)
await autoApprovePendingItems('<CLEARANCE_ID>')
```

---

### Option 3: Database Direct Query (Advanced)

**Check current state:**
```sql
-- See all approver assignments for BSPL
SELECT section_key, item_key, approver_id, 
       (SELECT full_name FROM users WHERE users.id = approver_id) as approver_name
FROM approver_assignments 
WHERE company_code = '1200'
ORDER BY section_key, item_key;

-- See clearances with pending items
SELECT DISTINCT cr.id, u.full_name, COUNT(ci.id) as pending_items
FROM clearance_requests cr
JOIN users u ON u.id = cr.employee_id
JOIN clearance_sections cs ON cs.clearance_request_id = cr.id
JOIN clearance_items ci ON ci.clearance_section_id = cs.id
WHERE u.company_code = '1200' AND ci.status = 'PENDING'
GROUP BY cr.id, u.full_name;
```

---

## "Action Failed" Error - Specific Troubleshooting

If one approver can see but gets "action failed":

**Check these in order:**

1. **Do they have the right DEPT_APPROVER_* role?**
   - Admin → Users → Find user → Check roles
   - If missing, add role manually

2. **Are they assigned to this specific section?**
   - Admin → Approvers → Select BSPL
   - Find the section
   - Confirm this user is listed as approver

3. **Have all items been marked APPROVED/NA?**
   - Open clearance
   - Check each item in the section
   - Mark any "Pending" items as APPROVED or N/A

4. **Try browser developer console:**
   - Open DevTools (F12)
   - Go to Network tab
   - Try approval again
   - Check the PATCH request response
   - Response will show exact error reason

---

## Database Schema Reference

**ApproverAssignment Table:**
```
approver_id      → User.id (who can approve)
company_code     → '1200' (BSPL)
section_key      → IR_DEPT, IT_DEPT, etc.
item_key         → 'section' (section-level) or specific item
```

**User Table:**
```
roles            → JSON array of role strings
                   e.g., ["DEPT_APPROVER_IR", "HRBP"]
```

**ClearanceItem Table:**
```
status           → PENDING, APPROVED, NA, DENIED
clearance_section_id → FK to ClearanceSection
```

---

## Quick Checklist

- [ ] Login as SUPER_ADMIN
- [ ] Go to Admin → Approvers
- [ ] Select "BSPL (1200)" company
- [ ] Check all sections have approvers assigned
- [ ] For each clearance with issues:
  - [ ] Open the clearance
  - [ ] Mark any pending items as APPROVED or N/A
  - [ ] Try to approve the section again
- [ ] If still failing, run diagnostic script and check error logs

---

## Getting Help

**Attach these when reporting:**
1. Output from debug endpoint: `/api/debug/approvers?clearanceId=<ID>`
2. User ID and name of approver having issues
3. Clearance ID where issue occurs
4. Browser console errors (F12 → Console)
5. Server logs (if accessible)
