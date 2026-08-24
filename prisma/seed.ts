import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Shared seed function – called both by main() and the dev reset API route
// ---------------------------------------------------------------------------
export async function runSeed(): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Clear tables in correct dependency order
  // -------------------------------------------------------------------------
  console.log('Clearing existing data...')
  await prisma.activityLog.deleteMany({})
  await prisma.notification.deleteMany({})
  await prisma.financeEntry.deleteMany({})
  await prisma.clearanceItem.deleteMany({})
  await prisma.clearanceSection.deleteMany({})
  await prisma.clearanceRequest.deleteMany({})
  await prisma.approverAssignment.deleteMany({})
  await prisma.user.deleteMany({})
  console.log('All tables cleared.')

  // -------------------------------------------------------------------------
  // 2. Hash the shared password once
  // -------------------------------------------------------------------------
  const SALT_ROUNDS = 10
  const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS)

  // -------------------------------------------------------------------------
  // 3. Create users
  // -------------------------------------------------------------------------
  console.log('Creating users...')

  await prisma.$transaction([
    // --- Approvers / Staff (no hrbp_id / line_manager_id) ---
    prisma.user.create({
      data: {
        id: 'user-u1',
        sf_employee_id: 'SF-1001',
        full_name: 'Ayesha Malik',
        email: 'ayesha.malik@company.com',
        password_hash: passwordHash,
        grade: 'M3',
        designation: 'HR Business Partner',
        department: 'Human Resources',
        division: 'People & Culture',
        company: 'Packages Ltd.',
        roles: ['HRBP'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u2',
        sf_employee_id: 'SF-1002',
        full_name: 'Omar Farooq',
        email: 'omar.farooq@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'IT Manager',
        department: 'Information Technology',
        division: 'Technology',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_IT'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u3',
        sf_employee_id: 'SF-1003',
        full_name: 'Sana Rehman',
        email: 'sana.rehman@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'IR Manager',
        department: 'Industrial Relations',
        division: 'People & Culture',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_IR'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u4',
        sf_employee_id: 'SF-1004',
        full_name: 'Bilal Ahmed',
        email: 'bilal.ahmed@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'Supply Chain Manager',
        department: 'Supply Management',
        division: 'Operations',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_SUPPLY'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u5',
        sf_employee_id: 'SF-1005',
        full_name: 'Nadia Khan',
        email: 'nadia.khan@company.com',
        password_hash: passwordHash,
        grade: 'M3',
        designation: 'ICS Head',
        department: 'Internal Customer Services',
        division: 'Operations',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_ICS'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u6',
        sf_employee_id: 'SF-1006',
        full_name: 'Tariq Hassan',
        email: 'tariq.hassan@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'Security Manager',
        department: 'Security',
        division: 'Operations',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_SECURITY'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u7',
        sf_employee_id: 'SF-1007',
        full_name: 'Farrukh Mirza',
        email: 'farrukh.mirza@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'Facilities Manager',
        department: 'Facilities',
        division: 'Operations',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_OTHER'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u8',
        sf_employee_id: 'SF-1008',
        full_name: 'Zara Qureshi',
        email: 'zara.qureshi@company.com',
        password_hash: passwordHash,
        grade: 'M4',
        designation: 'Regional Sales Director',
        department: 'Sales',
        division: 'Commercial',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_HEAD'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u9',
        sf_employee_id: 'SF-1009',
        full_name: 'Imran Sheikh',
        email: 'imran.sheikh@company.com',
        password_hash: passwordHash,
        grade: 'M2',
        designation: 'OD Manager',
        department: 'Organizational Development',
        division: 'People & Culture',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_OD'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u10',
        sf_employee_id: 'SF-1010',
        full_name: 'Rabia Siddiqui',
        email: 'rabia.siddiqui@company.com',
        password_hash: passwordHash,
        grade: 'M3',
        designation: 'Manager HR Operations',
        department: 'Human Resources',
        division: 'People & Culture',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_HR'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u11',
        sf_employee_id: 'SF-1011',
        full_name: 'Kamran Baig',
        email: 'kamran.baig@company.com',
        password_hash: passwordHash,
        grade: 'M4',
        designation: 'Financial Controller',
        department: 'Finance',
        division: 'Finance & Accounts',
        company: 'Packages Ltd.',
        roles: ['DEPT_APPROVER_FINANCE'],
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u12',
        sf_employee_id: 'SF-1012',
        full_name: 'Hassan Raza',
        email: 'hassan.raza@company.com',
        password_hash: passwordHash,
        grade: 'M1',
        designation: 'System Administrator',
        department: 'Human Resources',
        division: 'People & Culture',
        company: 'Packages Ltd.',
        roles: ['SUPER_ADMIN'],
      },
    }),
  ])

  // Employee users must be created after their managers/HRBPs exist
  await prisma.$transaction([
    prisma.user.create({
      data: {
        id: 'user-u13',
        sf_employee_id: 'SF-2001',
        full_name: 'Ali Raza',
        email: 'ali.raza@company.com',
        password_hash: passwordHash,
        grade: 'G3',
        designation: 'Senior Sales Executive',
        department: 'Sales',
        division: 'Commercial',
        company: 'Packages Ltd.',
        roles: ['EMPLOYEE'],
        hrbp_id: 'user-u1',
        line_manager_id: 'user-u8',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u14',
        sf_employee_id: 'SF-2002',
        full_name: 'Mehwish Tariq',
        email: 'mehwish.tariq@company.com',
        password_hash: passwordHash,
        grade: 'G3',
        designation: 'Software Engineer',
        department: 'Information Technology',
        division: 'Technology',
        company: 'Packages Ltd.',
        roles: ['EMPLOYEE'],
        hrbp_id: 'user-u1',
        line_manager_id: 'user-u2',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u15',
        sf_employee_id: 'SF-2003',
        full_name: 'Usman Ghani',
        email: 'usman.ghani@company.com',
        password_hash: passwordHash,
        grade: 'G3',
        designation: 'Finance Analyst',
        department: 'Finance',
        division: 'Finance & Accounts',
        company: 'Packages Ltd.',
        roles: ['EMPLOYEE'],
        hrbp_id: 'user-u1',
        line_manager_id: 'user-u11',
      },
    }),
    prisma.user.create({
      data: {
        id: 'user-u16',
        sf_employee_id: 'SF-2004',
        full_name: 'Hamid Siddiqui',
        email: 'hamid.siddiqui@company.com',
        password_hash: passwordHash,
        grade: 'G3',
        designation: 'Network Engineer',
        department: 'Information Technology',
        division: 'Technology',
        company: 'Packages Ltd.',
        roles: ['EMPLOYEE'],
        hrbp_id: 'user-u1',
        line_manager_id: 'user-u2',
      },
    }),
  ])

  console.log('16 users created.')

  // -------------------------------------------------------------------------
  // 4. Create clearance requests
  // -------------------------------------------------------------------------
  console.log('Creating clearance requests...')

  // ==========================================================================
  // CLR-2024-001 — Ali Raza — IN_PROGRESS
  // ==========================================================================
  await prisma.clearanceRequest.create({
    data: {
      id: 'clr-001',
      employee_id: 'user-u13',
      initiated_by_hrbp_id: 'user-u1',
      status: 'IN_PROGRESS',
      date_of_leaving: new Date('2024-02-15'),
      issued_by: 'user-u1',
      issuance_date: new Date('2024-01-20'),
      receiving_date: new Date('2024-01-20'),
      clearance_sections: {
        create: [
          // SECTION_1_HR_ISSUE – filled by HRBP, status APPROVED
          {
            section_key: 'SECTION_1_HR_ISSUE',
            status: 'APPROVED',
            approver_id: 'user-u1',
            approver_name: 'Ayesha Malik',
            decision_at: new Date('2024-01-20'),
            note: 'HR issuance section completed by HRBP.',
          },
          // IR_DEPT – APPROVED
          {
            section_key: 'IR_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u3',
            approver_name: 'Sana Rehman',
            decision_at: new Date('2024-01-22'),
            note: 'All items verified and cleared. Social security card collected.',
            clearance_items: {
              create: [
                {
                  item_key: 'social_security_card',
                  description: 'Social Security Card',
                  status: 'APPROVED',
                  comments: 'Card collected and filed',
                },
                {
                  item_key: 'fair_price_shop',
                  description: 'Fair Price Shop',
                  status: 'NA',
                  comments: 'N/A - not applicable',
                },
                {
                  item_key: 'uniform_locker',
                  description: 'Uniform & Locker',
                  status: 'APPROVED',
                  comments: 'Locker cleared, uniform returned',
                },
              ],
            },
          },
          // IT_DEPT – APPROVED
          {
            section_key: 'IT_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u2',
            approver_name: 'Omar Farooq',
            decision_at: new Date('2024-01-23'),
            note: 'Laptop wiped, accounts deactivated.',
            clearance_items: {
              create: [
                {
                  item_key: 'laptop_data_clearance',
                  description: 'Laptop/Desktop Data Clearance',
                  status: 'APPROVED',
                  comments: 'HP laptop wiped - serial WX23445',
                },
                {
                  item_key: 'email_sap_deactivation',
                  description: 'Email & SAP User Account Deactivation',
                  status: 'APPROVED',
                  comments: 'Both accounts deactivated',
                },
                {
                  item_key: 'it_other',
                  description: 'Other',
                  status: 'NA',
                  comments: 'N/A',
                },
              ],
            },
          },
          // SUPPLY_MGMT – PENDING
          {
            section_key: 'SUPPLY_MGMT',
            status: 'PENDING',
            clearance_items: {
              create: [
                {
                  item_key: 'central_stores',
                  description: 'Central Stores',
                  status: 'PENDING',
                },
                {
                  item_key: 'supply_other',
                  description: 'Other',
                  status: 'PENDING',
                },
              ],
            },
          },
          // ICS_DEPT – PENDING
          {
            section_key: 'ICS_DEPT',
            status: 'PENDING',
            clearance_items: {
              create: [
                {
                  item_key: 'library',
                  description: 'Library',
                  status: 'PENDING',
                },
                {
                  item_key: 'workshop',
                  description: 'Workshop',
                  status: 'PENDING',
                },
                {
                  item_key: 'ics_other',
                  description: 'Other',
                  status: 'PENDING',
                },
              ],
            },
          },
          // SECURITY – APPROVED
          {
            section_key: 'SECURITY',
            status: 'APPROVED',
            approver_id: 'user-u6',
            approver_name: 'Tariq Hassan',
            decision_at: new Date('2024-01-24'),
            note: 'Gate pass cancelled.',
            clearance_items: {
              create: [
                {
                  item_key: 'gate_office',
                  description: 'Gate Office',
                  status: 'APPROVED',
                  comments: 'Gate access revoked',
                },
                {
                  item_key: 'security_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OTHER_FACILITIES – PENDING
          {
            section_key: 'OTHER_FACILITIES',
            status: 'PENDING',
            clearance_items: {
              create: [
                {
                  item_key: 'telephone',
                  description: 'Telephone',
                  status: 'PENDING',
                },
                {
                  item_key: 'electrical',
                  description: 'Electrical',
                  status: 'PENDING',
                },
              ],
            },
          },
          // DEPT_HEAD – PENDING (assigned to Zara Qureshi)
          {
            section_key: 'DEPT_HEAD',
            status: 'PENDING',
            approver_id: 'user-u8',
            approver_name: 'Zara Qureshi',
            clearance_items: {
              create: [
                {
                  item_key: 'company_data_records',
                  description: 'Company Data/Records',
                  status: 'PENDING',
                },
                {
                  item_key: 'business_controller',
                  description: 'Business Controller',
                  status: 'PENDING',
                },
                {
                  item_key: 'dept_other',
                  description: 'Other',
                  status: 'PENDING',
                },
              ],
            },
          },
          // OD_DEPT – PENDING (locked)
          {
            section_key: 'OD_DEPT',
            status: 'PENDING',
          },
          // HR_DEPT – PENDING (locked)
          {
            section_key: 'HR_DEPT',
            status: 'PENDING',
          },
          // FINANCE – PENDING (locked)
          {
            section_key: 'FINANCE',
            status: 'PENDING',
          },
        ],
      },
    },
  })
  console.log('  CLR-2024-001 created.')

  // ==========================================================================
  // CLR-2024-002 — Mehwish Tariq — PENDING_HRBP (IT denied)
  // ==========================================================================
  await prisma.clearanceRequest.create({
    data: {
      id: 'clr-002',
      employee_id: 'user-u14',
      initiated_by_hrbp_id: 'user-u1',
      status: 'PENDING_HRBP',
      date_of_leaving: new Date('2024-02-28'),
      issued_by: 'user-u1',
      issuance_date: new Date('2024-01-25'),
      receiving_date: new Date('2024-01-25'),
      clearance_sections: {
        create: [
          // SECTION_1_HR_ISSUE – APPROVED
          {
            section_key: 'SECTION_1_HR_ISSUE',
            status: 'APPROVED',
            approver_id: 'user-u1',
            approver_name: 'Ayesha Malik',
            decision_at: new Date('2024-01-25'),
            note: 'HR issuance section completed by HRBP.',
          },
          // IR_DEPT – APPROVED
          {
            section_key: 'IR_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u3',
            approver_name: 'Sana Rehman',
            decision_at: new Date('2024-01-27'),
            note: 'All IR items verified and cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'social_security_card',
                  description: 'Social Security Card',
                  status: 'APPROVED',
                },
                {
                  item_key: 'fair_price_shop',
                  description: 'Fair Price Shop',
                  status: 'NA',
                },
                {
                  item_key: 'uniform_locker',
                  description: 'Uniform & Locker',
                  status: 'APPROVED',
                },
              ],
            },
          },
          // IT_DEPT – DENIED
          {
            section_key: 'IT_DEPT',
            status: 'DENIED',
            approver_id: 'user-u2',
            approver_name: 'Omar Farooq',
            decision_at: new Date('2024-01-28'),
            note: 'Laptop not yet returned. Employee has company laptop (Dell XPS, serial DX99812) and has not submitted it despite two reminders. Cannot clear until device is physically returned.',
            clearance_items: {
              create: [
                {
                  item_key: 'laptop_data_clearance',
                  description: 'Laptop/Desktop Data Clearance',
                  status: 'PENDING',
                  comments: 'Laptop not returned - Dell XPS DX99812',
                },
                {
                  item_key: 'email_sap_deactivation',
                  description: 'Email & SAP User Account Deactivation',
                  status: 'APPROVED',
                },
                {
                  item_key: 'it_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SUPPLY_MGMT – APPROVED
          {
            section_key: 'SUPPLY_MGMT',
            status: 'APPROVED',
            approver_id: 'user-u4',
            approver_name: 'Bilal Ahmed',
            decision_at: new Date('2024-01-27'),
            note: 'Supply management cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'central_stores',
                  description: 'Central Stores',
                  status: 'APPROVED',
                },
                {
                  item_key: 'supply_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // ICS_DEPT – APPROVED
          {
            section_key: 'ICS_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u5',
            approver_name: 'Nadia Khan',
            decision_at: new Date('2024-01-27'),
            note: 'No ICS obligations.',
            clearance_items: {
              create: [
                {
                  item_key: 'library',
                  description: 'Library',
                  status: 'NA',
                },
                {
                  item_key: 'workshop',
                  description: 'Workshop',
                  status: 'NA',
                },
                {
                  item_key: 'ics_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SECURITY – APPROVED
          {
            section_key: 'SECURITY',
            status: 'APPROVED',
            approver_id: 'user-u6',
            approver_name: 'Tariq Hassan',
            decision_at: new Date('2024-01-27'),
            note: 'Gate pass cancelled.',
            clearance_items: {
              create: [
                {
                  item_key: 'gate_office',
                  description: 'Gate Office',
                  status: 'APPROVED',
                },
                {
                  item_key: 'security_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OTHER_FACILITIES – APPROVED
          {
            section_key: 'OTHER_FACILITIES',
            status: 'APPROVED',
            approver_id: 'user-u7',
            approver_name: 'Farrukh Mirza',
            decision_at: new Date('2024-01-27'),
            note: 'No facilities obligations.',
            clearance_items: {
              create: [
                {
                  item_key: 'telephone',
                  description: 'Telephone',
                  status: 'NA',
                },
                {
                  item_key: 'electrical',
                  description: 'Electrical',
                  status: 'NA',
                },
              ],
            },
          },
          // DEPT_HEAD – APPROVED
          {
            section_key: 'DEPT_HEAD',
            status: 'APPROVED',
            approver_id: 'user-u8',
            approver_name: 'Zara Qureshi',
            decision_at: new Date('2024-01-28'),
            note: 'All department records accounted for.',
            clearance_items: {
              create: [
                {
                  item_key: 'company_data_records',
                  description: 'Company Data/Records',
                  status: 'APPROVED',
                },
                {
                  item_key: 'business_controller',
                  description: 'Business Controller',
                  status: 'NA',
                },
                {
                  item_key: 'dept_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OD_DEPT – PENDING (locked)
          {
            section_key: 'OD_DEPT',
            status: 'PENDING',
          },
          // HR_DEPT – PENDING (locked)
          {
            section_key: 'HR_DEPT',
            status: 'PENDING',
          },
          // FINANCE – PENDING (locked)
          {
            section_key: 'FINANCE',
            status: 'PENDING',
          },
        ],
      },
    },
  })
  console.log('  CLR-2024-002 created.')

  // ==========================================================================
  // CLR-2024-003 — Usman Ghani — IN_PROGRESS (Section 3 active, HR pending)
  // ==========================================================================
  await prisma.clearanceRequest.create({
    data: {
      id: 'clr-003',
      employee_id: 'user-u15',
      initiated_by_hrbp_id: 'user-u1',
      status: 'IN_PROGRESS',
      date_of_leaving: new Date('2024-01-31'),
      issued_by: 'user-u1',
      issuance_date: new Date('2024-01-10'),
      receiving_date: new Date('2024-01-10'),
      clearance_sections: {
        create: [
          // SECTION_1_HR_ISSUE – APPROVED
          {
            section_key: 'SECTION_1_HR_ISSUE',
            status: 'APPROVED',
            approver_id: 'user-u1',
            approver_name: 'Ayesha Malik',
            decision_at: new Date('2024-01-10'),
            note: 'HR issuance section completed by HRBP.',
          },
          // IR_DEPT – APPROVED
          {
            section_key: 'IR_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u3',
            approver_name: 'Sana Rehman',
            decision_at: new Date('2024-01-12'),
            note: 'IR clearance complete.',
            clearance_items: {
              create: [
                {
                  item_key: 'social_security_card',
                  description: 'Social Security Card',
                  status: 'APPROVED',
                  comments: 'Card collected',
                },
                {
                  item_key: 'fair_price_shop',
                  description: 'Fair Price Shop',
                  status: 'NA',
                },
                {
                  item_key: 'uniform_locker',
                  description: 'Uniform & Locker',
                  status: 'APPROVED',
                  comments: 'Locker cleared',
                },
              ],
            },
          },
          // IT_DEPT – APPROVED
          {
            section_key: 'IT_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u2',
            approver_name: 'Omar Farooq',
            decision_at: new Date('2024-01-12'),
            note: 'IT assets cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'laptop_data_clearance',
                  description: 'Laptop/Desktop Data Clearance',
                  status: 'APPROVED',
                  comments: 'Laptop returned and wiped',
                },
                {
                  item_key: 'email_sap_deactivation',
                  description: 'Email & SAP User Account Deactivation',
                  status: 'APPROVED',
                  comments: 'Accounts deactivated',
                },
                {
                  item_key: 'it_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SUPPLY_MGMT – APPROVED
          {
            section_key: 'SUPPLY_MGMT',
            status: 'APPROVED',
            approver_id: 'user-u4',
            approver_name: 'Bilal Ahmed',
            decision_at: new Date('2024-01-13'),
            note: 'No supply items outstanding.',
            clearance_items: {
              create: [
                {
                  item_key: 'central_stores',
                  description: 'Central Stores',
                  status: 'APPROVED',
                },
                {
                  item_key: 'supply_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // ICS_DEPT – APPROVED
          {
            section_key: 'ICS_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u5',
            approver_name: 'Nadia Khan',
            decision_at: new Date('2024-01-13'),
            note: 'ICS cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'library',
                  description: 'Library',
                  status: 'NA',
                },
                {
                  item_key: 'workshop',
                  description: 'Workshop',
                  status: 'NA',
                },
                {
                  item_key: 'ics_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SECURITY – APPROVED
          {
            section_key: 'SECURITY',
            status: 'APPROVED',
            approver_id: 'user-u6',
            approver_name: 'Tariq Hassan',
            decision_at: new Date('2024-01-13'),
            note: 'Security clearance done.',
            clearance_items: {
              create: [
                {
                  item_key: 'gate_office',
                  description: 'Gate Office',
                  status: 'APPROVED',
                  comments: 'Gate access revoked',
                },
                {
                  item_key: 'security_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OTHER_FACILITIES – APPROVED
          {
            section_key: 'OTHER_FACILITIES',
            status: 'APPROVED',
            approver_id: 'user-u7',
            approver_name: 'Farrukh Mirza',
            decision_at: new Date('2024-01-14'),
            note: 'Facilities cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'telephone',
                  description: 'Telephone',
                  status: 'NA',
                },
                {
                  item_key: 'electrical',
                  description: 'Electrical',
                  status: 'NA',
                },
              ],
            },
          },
          // DEPT_HEAD – APPROVED
          {
            section_key: 'DEPT_HEAD',
            status: 'APPROVED',
            approver_id: 'user-u11',
            approver_name: 'Kamran Baig',
            decision_at: new Date('2024-01-15'),
            note: 'Department head cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'company_data_records',
                  description: 'Company Data/Records',
                  status: 'APPROVED',
                },
                {
                  item_key: 'business_controller',
                  description: 'Business Controller',
                  status: 'APPROVED',
                },
                {
                  item_key: 'dept_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OD_DEPT – APPROVED (Section 3 active)
          {
            section_key: 'OD_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u9',
            approver_name: 'Imran Sheikh',
            decision_at: new Date('2024-01-16'),
            note: 'No training bond. All OD obligations cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'training_bond',
                  description: 'Training Bond',
                  status: 'NA',
                  comments: 'No training bond applicable',
                },
                {
                  item_key: 'od_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // HR_DEPT – PENDING (approver pre-assigned, not yet acted)
          {
            section_key: 'HR_DEPT',
            status: 'PENDING',
            approver_id: 'user-u10',
            approver_name: 'Rabia Siddiqui',
            clearance_items: {
              create: [
                {
                  item_key: 'employee_id_access_card',
                  description: 'Employee ID / Access Card',
                  status: 'PENDING',
                },
                {
                  item_key: 'health_insurance_card',
                  description: 'Health Insurance Card',
                  status: 'PENDING',
                },
                {
                  item_key: 'sim',
                  description: 'SIM',
                  status: 'PENDING',
                },
                {
                  item_key: 'cell_phone',
                  description: 'Cell Phone',
                  status: 'PENDING',
                },
                {
                  item_key: 'laptop',
                  description: 'Laptop',
                  status: 'PENDING',
                },
                {
                  item_key: 'vehicle_bike',
                  description: 'Vehicle / Bike',
                  status: 'PENDING',
                },
                {
                  item_key: 'fuel_card',
                  description: 'Fuel Card',
                  status: 'PENDING',
                },
                {
                  item_key: 'project_buraq',
                  description: 'Project Buraq',
                  status: 'PENDING',
                },
                {
                  item_key: 'hr_other',
                  description: 'Other',
                  status: 'PENDING',
                },
              ],
            },
          },
          // FINANCE – PENDING (approver pre-assigned)
          {
            section_key: 'FINANCE',
            status: 'PENDING',
            approver_id: 'user-u11',
            approver_name: 'Kamran Baig',
          },
        ],
      },
    },
  })
  console.log('  CLR-2024-003 created.')

  // Finance entries for CLR-2024-003 (all amounts null)
  console.log('  Creating finance entries for CLR-2024-003...')
  await prisma.financeEntry.createMany({
    data: [
      // PAYABLES
      { clearance_request_id: 'clr-003', section_group: 'PAYABLES', gl_account: '371001', particulars: 'Vendor/Imprest (Also create vendor if does not exist)', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'PAYABLES', gl_account: '856007', particulars: 'Packages Ltd.', amount_pkr: null },
      // INVENTORY
      { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '417099', particulars: 'Company Car/Bike Loan', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: null, particulars: 'Transfer of Vehicle Ownership', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Laptop', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Personal Entitlements', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'INVENTORY', gl_account: '642003', particulars: 'Fair Price Shop', amount_pkr: null },
      // ERS
      { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: '642006', particulars: 'Travelling Advance', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: '642012', particulars: 'Other Advances', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: null, particulars: 'Fuel Adjustment', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'ERS', gl_account: null, particulars: 'Any Unpaid Voucher', amount_pkr: null },
      // PAYROLL_FUNDS
      { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '521002', particulars: 'Cycle Loan', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642001', particulars: 'Salary/HR Advance', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642004', particulars: 'Eid Advance', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642005', particulars: 'Christmas Advance', amount_pkr: null },
      { clearance_request_id: 'clr-003', section_group: 'PAYROLL_FUNDS', gl_account: '642009', particulars: 'Other Advances', amount_pkr: null },
    ],
  })
  console.log('  Finance entries for CLR-2024-003 created.')

  // ==========================================================================
  // CLR-2023-047 — Hamid Siddiqui — COMPLETED
  // ==========================================================================
  await prisma.clearanceRequest.create({
    data: {
      id: 'clr-047',
      employee_id: 'user-u16',
      initiated_by_hrbp_id: 'user-u1',
      status: 'COMPLETED',
      pdf_generated: true,
      pdf_generated_at: new Date('2023-12-30'),
      date_of_leaving: new Date('2023-12-31'),
      issued_by: 'user-u1',
      issuance_date: new Date('2023-12-15'),
      receiving_date: new Date('2023-12-15'),
      clearance_sections: {
        create: [
          // SECTION_1_HR_ISSUE – APPROVED
          {
            section_key: 'SECTION_1_HR_ISSUE',
            status: 'APPROVED',
            approver_id: 'user-u1',
            approver_name: 'Ayesha Malik',
            decision_at: new Date('2023-12-15'),
            note: 'HR issuance section completed by HRBP.',
          },
          // IR_DEPT – APPROVED
          {
            section_key: 'IR_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u3',
            approver_name: 'Sana Rehman',
            decision_at: new Date('2023-12-16'),
            note: 'IR cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'social_security_card',
                  description: 'Social Security Card',
                  status: 'APPROVED',
                  comments: 'Card collected',
                },
                {
                  item_key: 'fair_price_shop',
                  description: 'Fair Price Shop',
                  status: 'NA',
                },
                {
                  item_key: 'uniform_locker',
                  description: 'Uniform & Locker',
                  status: 'APPROVED',
                  comments: 'Locker cleared, uniform returned',
                },
              ],
            },
          },
          // IT_DEPT – APPROVED
          {
            section_key: 'IT_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u2',
            approver_name: 'Omar Farooq',
            decision_at: new Date('2023-12-17'),
            note: 'IT assets cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'laptop_data_clearance',
                  description: 'Laptop/Desktop Data Clearance',
                  status: 'APPROVED',
                  comments: 'Laptop wiped and returned',
                },
                {
                  item_key: 'email_sap_deactivation',
                  description: 'Email & SAP User Account Deactivation',
                  status: 'APPROVED',
                  comments: 'All accounts deactivated',
                },
                {
                  item_key: 'it_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SUPPLY_MGMT – APPROVED
          {
            section_key: 'SUPPLY_MGMT',
            status: 'APPROVED',
            approver_id: 'user-u4',
            approver_name: 'Bilal Ahmed',
            decision_at: new Date('2023-12-18'),
            note: 'Supply cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'central_stores',
                  description: 'Central Stores',
                  status: 'APPROVED',
                },
                {
                  item_key: 'supply_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // ICS_DEPT – APPROVED
          {
            section_key: 'ICS_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u5',
            approver_name: 'Nadia Khan',
            decision_at: new Date('2023-12-18'),
            note: 'ICS cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'library',
                  description: 'Library',
                  status: 'NA',
                },
                {
                  item_key: 'workshop',
                  description: 'Workshop',
                  status: 'NA',
                },
                {
                  item_key: 'ics_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // SECURITY – APPROVED
          {
            section_key: 'SECURITY',
            status: 'APPROVED',
            approver_id: 'user-u6',
            approver_name: 'Tariq Hassan',
            decision_at: new Date('2023-12-19'),
            note: 'Gate pass cancelled.',
            clearance_items: {
              create: [
                {
                  item_key: 'gate_office',
                  description: 'Gate Office',
                  status: 'APPROVED',
                  comments: 'Gate access revoked',
                },
                {
                  item_key: 'security_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OTHER_FACILITIES – APPROVED
          {
            section_key: 'OTHER_FACILITIES',
            status: 'APPROVED',
            approver_id: 'user-u7',
            approver_name: 'Farrukh Mirza',
            decision_at: new Date('2023-12-20'),
            note: 'Facilities cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'telephone',
                  description: 'Telephone',
                  status: 'NA',
                },
                {
                  item_key: 'electrical',
                  description: 'Electrical',
                  status: 'NA',
                },
              ],
            },
          },
          // DEPT_HEAD – APPROVED
          {
            section_key: 'DEPT_HEAD',
            status: 'APPROVED',
            approver_id: 'user-u2',
            approver_name: 'Omar Farooq',
            decision_at: new Date('2023-12-21'),
            note: 'Department head clearance complete.',
            clearance_items: {
              create: [
                {
                  item_key: 'company_data_records',
                  description: 'Company Data/Records',
                  status: 'APPROVED',
                },
                {
                  item_key: 'business_controller',
                  description: 'Business Controller',
                  status: 'NA',
                },
                {
                  item_key: 'dept_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // OD_DEPT – APPROVED
          {
            section_key: 'OD_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u9',
            approver_name: 'Imran Sheikh',
            decision_at: new Date('2023-12-22'),
            note: 'No training bond. OD cleared.',
            clearance_items: {
              create: [
                {
                  item_key: 'training_bond',
                  description: 'Training Bond',
                  status: 'NA',
                  comments: 'No training bond applicable',
                },
                {
                  item_key: 'od_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // HR_DEPT – APPROVED
          {
            section_key: 'HR_DEPT',
            status: 'APPROVED',
            approver_id: 'user-u10',
            approver_name: 'Rabia Siddiqui',
            decision_at: new Date('2023-12-27'),
            note: 'All HR assets collected.',
            clearance_items: {
              create: [
                {
                  item_key: 'employee_id_access_card',
                  description: 'Employee ID / Access Card',
                  status: 'APPROVED',
                  comments: 'Card collected',
                },
                {
                  item_key: 'health_insurance_card',
                  description: 'Health Insurance Card',
                  status: 'APPROVED',
                  comments: 'Card cancelled and collected',
                },
                {
                  item_key: 'sim',
                  description: 'SIM',
                  status: 'APPROVED',
                  comments: 'SIM returned',
                },
                {
                  item_key: 'cell_phone',
                  description: 'Cell Phone',
                  status: 'NA',
                },
                {
                  item_key: 'laptop',
                  description: 'Laptop',
                  status: 'APPROVED',
                  comments: 'Laptop returned',
                },
                {
                  item_key: 'vehicle_bike',
                  description: 'Vehicle / Bike',
                  status: 'NA',
                },
                {
                  item_key: 'fuel_card',
                  description: 'Fuel Card',
                  status: 'NA',
                },
                {
                  item_key: 'project_buraq',
                  description: 'Project Buraq',
                  status: 'NA',
                },
                {
                  item_key: 'hr_other',
                  description: 'Other',
                  status: 'NA',
                },
              ],
            },
          },
          // FINANCE – APPROVED
          {
            section_key: 'FINANCE',
            status: 'APPROVED',
            approver_id: 'user-u11',
            approver_name: 'Kamran Baig',
            decision_at: new Date('2023-12-29'),
            note: 'All financial obligations settled.',
          },
        ],
      },
    },
  })
  console.log('  CLR-2023-047 created.')

  // Finance entries for CLR-2023-047 (with actual amounts)
  console.log('  Creating finance entries for CLR-2023-047...')
  await prisma.financeEntry.createMany({
    data: [
      // PAYABLES
      { clearance_request_id: 'clr-047', section_group: 'PAYABLES', gl_account: '371001', particulars: 'Vendor/Imprest (Also create vendor if does not exist)', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'PAYABLES', gl_account: '856007', particulars: 'Packages Ltd.', amount_pkr: 2500 },
      // INVENTORY
      { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '417099', particulars: 'Company Car/Bike Loan', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: null, particulars: 'Transfer of Vehicle Ownership', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Laptop', amount_pkr: 85000 },
      { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '415099', particulars: 'Personal Entitlements', amount_pkr: 12000 },
      { clearance_request_id: 'clr-047', section_group: 'INVENTORY', gl_account: '642003', particulars: 'Fair Price Shop', amount_pkr: 3200 },
      // ERS
      { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: '642006', particulars: 'Travelling Advance', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: '642012', particulars: 'Other Advances', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: null, particulars: 'Fuel Adjustment', amount_pkr: 4500 },
      { clearance_request_id: 'clr-047', section_group: 'ERS', gl_account: null, particulars: 'Any Unpaid Voucher', amount_pkr: 0 },
      // PAYROLL_FUNDS
      { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '521002', particulars: 'Cycle Loan', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642001', particulars: 'Salary/HR Advance', amount_pkr: 15000 },
      { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642004', particulars: 'Eid Advance', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642005', particulars: 'Christmas Advance', amount_pkr: 0 },
      { clearance_request_id: 'clr-047', section_group: 'PAYROLL_FUNDS', gl_account: '642009', particulars: 'Other Advances', amount_pkr: 0 },
    ],
  })
  console.log('  Finance entries for CLR-2023-047 created.')

  console.log('All clearance requests and finance entries created.')

  // -------------------------------------------------------------------------
  // 5. Create notifications
  // -------------------------------------------------------------------------
  console.log('Creating notifications...')
  await prisma.notification.createMany({
    data: [
      // Notifications for u1 (Ayesha Malik – HRBP)
      {
        recipient_id: 'user-u1',
        clearance_request_id: 'clr-002',
        type: 'DENIAL',
        message: 'IT Department has denied the clearance for Mehwish Tariq. Reason: Laptop not yet returned.',
        read: false,
        created_at: new Date('2024-01-28'),
      },
      {
        recipient_id: 'user-u1',
        clearance_request_id: 'clr-002',
        type: 'APPROVAL',
        message: 'Supply Management has approved the clearance for Mehwish Tariq.',
        read: false,
        created_at: new Date('2024-01-27'),
      },
      {
        recipient_id: 'user-u1',
        clearance_request_id: 'clr-003',
        type: 'APPROVAL',
        message: 'OD Department has approved Section 3 for Usman Ghani.',
        read: false,
        created_at: new Date('2024-01-16'),
      },
      {
        recipient_id: 'user-u1',
        clearance_request_id: 'clr-047',
        type: 'COMPLETED',
        message: 'Clearance for Hamid Siddiqui has been fully completed. PDF is ready for download.',
        read: true,
        created_at: new Date('2023-12-30'),
      },
      {
        recipient_id: 'user-u1',
        clearance_request_id: 'clr-003',
        type: 'SECTION3_UNLOCKED',
        message: 'All Section 2 departments have approved the clearance for Usman Ghani. Section 3 is now active.',
        read: true,
        created_at: new Date('2024-01-15'),
      },
      // Notification for u2 (Omar Farooq – IT approver)
      {
        recipient_id: 'user-u2',
        clearance_request_id: 'clr-001',
        type: 'NEW_CLEARANCE',
        message: 'A new clearance has been initiated for Ali Raza. Your approval is required.',
        read: false,
        created_at: new Date('2024-01-20'),
      },
      // Notification for u10 (Rabia Siddiqui – HR approver)
      {
        recipient_id: 'user-u10',
        clearance_request_id: 'clr-003',
        type: 'SECTION3_UNLOCKED',
        message: 'Section 3 is now active for Usman Ghani. Please complete the HR asset collection.',
        read: false,
        created_at: new Date('2024-01-15'),
      },
    ],
  })
  console.log('Notifications created.')

  // -------------------------------------------------------------------------
  // 6. Create activity logs
  // -------------------------------------------------------------------------
  console.log('Creating activity logs...')
  await prisma.activityLog.createMany({
    data: [
      // ------- CLR-2024-001 (Ali Raza) -------
      {
        clearance_request_id: 'clr-001',
        actor_id: 'user-u1',
        action: 'CLEARANCE_INITIATED',
        details: 'Clearance request CLR-2024-001 initiated for Ali Raza (SF-2001) by Ayesha Malik. Date of leaving: 2024-02-15.',
        created_at: new Date('2024-01-20T09:00:00Z'),
      },
      {
        clearance_request_id: 'clr-001',
        actor_id: 'user-u3',
        action: 'SECTION_APPROVED',
        details: 'IR Department approved by Sana Rehman. Social security card collected, locker cleared.',
        created_at: new Date('2024-01-22T10:30:00Z'),
      },
      {
        clearance_request_id: 'clr-001',
        actor_id: 'user-u2',
        action: 'SECTION_APPROVED',
        details: 'IT Department approved by Omar Farooq. Laptop wiped (serial WX23445), accounts deactivated.',
        created_at: new Date('2024-01-23T11:00:00Z'),
      },
      {
        clearance_request_id: 'clr-001',
        actor_id: 'user-u6',
        action: 'SECTION_APPROVED',
        details: 'Security Department approved by Tariq Hassan. Gate pass cancelled.',
        created_at: new Date('2024-01-24T09:45:00Z'),
      },
      {
        clearance_request_id: 'clr-001',
        actor_id: 'user-u1',
        action: 'HRBP_NOTIFIED',
        details: 'Awaiting approvals from Supply Management, ICS, Other Facilities, and Department Head.',
        created_at: new Date('2024-01-24T10:00:00Z'),
      },

      // ------- CLR-2024-002 (Mehwish Tariq) -------
      {
        clearance_request_id: 'clr-002',
        actor_id: 'user-u1',
        action: 'CLEARANCE_INITIATED',
        details: 'Clearance request CLR-2024-002 initiated for Mehwish Tariq (SF-2002) by Ayesha Malik. Date of leaving: 2024-02-28.',
        created_at: new Date('2024-01-25T09:00:00Z'),
      },
      {
        clearance_request_id: 'clr-002',
        actor_id: 'user-u3',
        action: 'SECTION_APPROVED',
        details: 'IR Department approved by Sana Rehman.',
        created_at: new Date('2024-01-27T10:00:00Z'),
      },
      {
        clearance_request_id: 'clr-002',
        actor_id: 'user-u4',
        action: 'SECTION_APPROVED',
        details: 'Supply Management approved by Bilal Ahmed.',
        created_at: new Date('2024-01-27T10:30:00Z'),
      },
      {
        clearance_request_id: 'clr-002',
        actor_id: 'user-u2',
        action: 'SECTION_DENIED',
        details: 'IT Department denied by Omar Farooq. Reason: Laptop not yet returned (Dell XPS, serial DX99812). Two reminders sent with no response.',
        created_at: new Date('2024-01-28T14:00:00Z'),
      },
      {
        clearance_request_id: 'clr-002',
        actor_id: 'user-u1',
        action: 'HRBP_NOTIFIED',
        details: 'HRBP Ayesha Malik notified of IT denial. Clearance status set to PENDING_HRBP pending resolution.',
        created_at: new Date('2024-01-28T14:05:00Z'),
      },

      // ------- CLR-2024-003 (Usman Ghani) -------
      {
        clearance_request_id: 'clr-003',
        actor_id: 'user-u1',
        action: 'CLEARANCE_INITIATED',
        details: 'Clearance request CLR-2024-003 initiated for Usman Ghani (SF-2003) by Ayesha Malik. Date of leaving: 2024-01-31.',
        created_at: new Date('2024-01-10T09:00:00Z'),
      },
      {
        clearance_request_id: 'clr-003',
        actor_id: 'user-u3',
        action: 'SECTION_APPROVED',
        details: 'IR Department approved by Sana Rehman.',
        created_at: new Date('2024-01-12T10:00:00Z'),
      },
      {
        clearance_request_id: 'clr-003',
        actor_id: 'user-u8',
        action: 'SECTION_APPROVED',
        details: 'Department Head (Finance – Kamran Baig) approved all department records and business controller items.',
        created_at: new Date('2024-01-15T11:00:00Z'),
      },
      {
        clearance_request_id: 'clr-003',
        actor_id: 'user-u1',
        action: 'SECTION3_UNLOCKED',
        details: 'All Section 2 departments have approved. Section 3 (OD, HR, Finance) is now active.',
        created_at: new Date('2024-01-15T11:05:00Z'),
      },
      {
        clearance_request_id: 'clr-003',
        actor_id: 'user-u9',
        action: 'SECTION_APPROVED',
        details: 'OD Department approved by Imran Sheikh. No training bond applicable.',
        created_at: new Date('2024-01-16T09:00:00Z'),
      },

      // ------- CLR-2023-047 (Hamid Siddiqui) -------
      {
        clearance_request_id: 'clr-047',
        actor_id: 'user-u1',
        action: 'CLEARANCE_INITIATED',
        details: 'Clearance request CLR-2023-047 initiated for Hamid Siddiqui (SF-2004) by Ayesha Malik. Date of leaving: 2023-12-31.',
        created_at: new Date('2023-12-15T09:00:00Z'),
      },
      {
        clearance_request_id: 'clr-047',
        actor_id: 'user-u1',
        action: 'SECTION3_UNLOCKED',
        details: 'All Section 2 departments approved. Section 3 (OD, HR, Finance) unlocked.',
        created_at: new Date('2023-12-22T09:00:00Z'),
      },
      {
        clearance_request_id: 'clr-047',
        actor_id: 'user-u11',
        action: 'SECTION_APPROVED',
        details: 'Finance section approved by Kamran Baig. All financial amounts verified and settled.',
        created_at: new Date('2023-12-29T14:00:00Z'),
      },
      {
        clearance_request_id: 'clr-047',
        actor_id: 'user-u1',
        action: 'PDF_GENERATED',
        details: 'Clearance PDF generated for Hamid Siddiqui.',
        created_at: new Date('2023-12-30T10:00:00Z'),
      },
      {
        clearance_request_id: 'clr-047',
        actor_id: 'user-u1',
        action: 'COMPLETION_EMAIL_SENT',
        details: 'Completion email sent to Hamid Siddiqui (hamid.siddiqui@company.com) and HR records updated.',
        created_at: new Date('2023-12-30T10:05:00Z'),
      },
    ],
  })
  console.log('Activity logs created.')

  // -------------------------------------------------------------------------
  // Default approver (SF employee 10009673) + approver assignments
  // -------------------------------------------------------------------------
  console.log('Creating default approver and approver assignments...')

  const defaultApprover = await prisma.user.upsert({
    where: { sf_employee_id: '10009673' },
    update: {},
    create: {
      id: 'user-default-approver',
      sf_employee_id: '10009673',
      full_name: 'Default Approver',
      email: 'default.approver@packagesli.com',
      password_hash: passwordHash,
      grade: 'M2',
      designation: 'Approver',
      department: 'Human Resources',
      division: 'People & Culture',
      company: 'Packages Ltd.',
      company_code: '1000',
      roles: [
        'DEPT_APPROVER_IR', 'DEPT_APPROVER_IT', 'DEPT_APPROVER_SUPPLY',
        'DEPT_APPROVER_ICS', 'DEPT_APPROVER_SECURITY', 'DEPT_APPROVER_OTHER',
        'DEPT_APPROVER_HEAD', 'DEPT_APPROVER_OD', 'DEPT_APPROVER_HR', 'DEPT_APPROVER_FINANCE',
      ],
    },
  })

  const COMPANY_CODES = ['1000', '1100', '1200', '1300', '1400', '1500', '1600', '1700']
  const ALL_SECTION_ITEMS: Record<string, string[]> = {
    IR_DEPT:           ['social_security_card', 'fair_price_shop', 'uniform_locker'],
    IT_DEPT:           ['laptop_data_clearance', 'email_sap_deactivation', 'it_other'],
    SUPPLY_MGMT:       ['central_stores', 'supply_other'],
    ICS_DEPT:          ['library', 'workshop', 'ics_other'],
    SECURITY:          ['gate_office', 'security_other'],
    OTHER_FACILITIES:  ['telephone', 'electrical'],
    DEPT_HEAD:         ['company_data_records', 'business_controller', 'dept_other'],
    OD_DEPT:           ['training_bond', 'od_other'],
    HR_DEPT:           ['employee_id_access_card', 'health_insurance_card', 'sim', 'cell_phone', 'laptop', 'vehicle_bike', 'fuel_card', 'project_buraq', 'hr_other'],
  }

  for (const companyCode of COMPANY_CODES) {
    for (const [sectionKey, itemKeys] of Object.entries(ALL_SECTION_ITEMS)) {
      for (const itemKey of itemKeys) {
        await prisma.approverAssignment.upsert({
          where: {
            company_code_section_key_item_key_approver_id: {
              company_code: companyCode,
              section_key: sectionKey,
              item_key: itemKey,
              approver_id: defaultApprover.id,
            },
          },
          update: {},
          create: {
            company_code: companyCode,
            section_key: sectionKey,
            item_key: itemKey,
            approver_id: defaultApprover.id,
          },
        })
      }
    }
  }

  console.log(`Default approver assignments created for all ${COMPANY_CODES.length} companies.`)

  console.log('\nSeed completed successfully!')
  console.log('Summary:')
  console.log('  - 17 users created (u1–u16 + default approver)')
  console.log('  - 4 clearance requests created (clr-001, clr-002, clr-003, clr-047)')
  console.log('  - Finance entries created for clr-003 (null amounts) and clr-047 (with amounts)')
  console.log('  - 7 notifications created')
  console.log('  - 20 activity log entries created')
  console.log('  - Approver assignments seeded for all companies and sections')
}

// ---------------------------------------------------------------------------
// Entry point — only runs when executed directly via `npx prisma db seed`
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  try {
    await runSeed()
  } catch (error) {
    console.error('Seed failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
