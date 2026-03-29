# SAP SuccessFactors API – Data Requirements

> **Column guide:** `#` | `Data Required` | `SF Technical Field Name` | `Notes`

## 1. Authentication

| # | Data Required | SF Technical Field Name | Notes |
|---|--------------|------------------------|-------|
| 1.1 | Company ID | packagesli | Required for all API calls |
| 1.2 | OAuth Client ID |  |  |
| 1.3 | OAuth Client Secret |  |  |
| 1.4 | API Base URL |  | e.g. https://api4.successfactors.com |
| 1.5 | User Account Status (Active/Inactive) |  | To block terminated users from logging in |

## 2. Employee Profile

| # | Data Required | SF Technical Field Name | Notes |
|---|--------------|------------------------|-------|
| 2.1 | Employee ID | userId | Unique identifier |
| 2.2 | First Name | firstName |  |
| 2.3 | Last Name | lastName |  |
| 2.4 | Full Name (Display) | displayName |  |
| 2.5 | Work Email Address | emailAddress | Used for login & notifications |
| 2.6 | Personal Email Address |  | Optional |
| 2.7 | Date of Birth | dateOfBirth |  |
| 2.8 | Mobile Number | phoneNumber | Optional / future SMS |
| 2.9 | Profile Photo |  | Optional |
| 2.10 | Grade / Pay Grade | payGrade | Shown on clearance form |
| 2.11 | Designation / Job Title | title | Shown on clearance form |
| 2.12 | Department | department | Drives approver auto-assignment E.g Non-ERP Support (30000021) |
| 2.13 | Department Code | department | Example: "Manufacturing (30000012)" |
| 2.14 | Division | division | Shown on clearance form |
| 2.15 | Company Name | company | Will return code I will hardcode the list prompt me for it |
| 2.16 | Date of Joining | jobEntryDate | all dates will be returned in milliseconds since Unix epoch has to be converted to dd/mm/yyyy |
| 2.17 | Date of Leaving / Last Working Day | *Will be entered on our portal* | Critical — drives clearance urgency |
| 2.18 | Employee Type | employmentType | e.g. Full-time, Contractor |
| 2.19 | Employment Status | emplStatus | Active / Terminated / On Notice - Active will show 18203 and terminated will show 18195 |
| 2.20 | Cost Center | costCenter | For Finance section |

## 3. Reporting Structure

| # | Data Required | SF Technical Field Name | Notes |
|---|--------------|------------------------|-------|
| 3.1 | Line Manager Employee ID | managerId | To link portal account |
| 3.2 | Line Manager Full Name | Take by sending managerid through the api call | Auto-assigned as Dept. Head approver |
| 3.3 | Line Manager Work Email | Take by sending managerid through the api call | For notifications |
| 3.4 | HRBP Employee ID | relUserId | To link portal account |
| 3.5 | HRBP Full Name | displayName | Hit the User Copy api with HRBP Employee ID |
| 3.6 | HRBP Work Email | emailAddress | Hit the User Copy api with HRBP Employee ID |

## 4. Role & Access Mapping

| # | Data Required | SF Technical Field Name | Notes |
|---|--------------|------------------------|-------|
| 4.1 | Job Function / Job Role | localJobTitle | Maps user to portal role |
| 4.2 | Is Manager Flag | I will assign those manually giving you a list against their employee codes and specific company code | For DEPT_APPROVER_HEAD assignment |
| 4.3 | Business Unit | businessUnit | For approver scope filtering |
| 4.4 | Position Title | localJobTitle | Cross-reference for role assignment |
