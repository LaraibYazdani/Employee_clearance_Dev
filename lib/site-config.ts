export const IS_TEST_SERVER = true

export const SITE_NAME = 'Employee Clearance Portal'
export const COMPANY_NAME = 'Packages Group'

export const TEST_BANNER_MESSAGE =
  'DEVELOPMENT / TESTING SERVER — Not connected to live systems. Data and actions here are for training and testing only.'

export const EMAIL_SUBJECT_PREFIX = IS_TEST_SERVER ? '[TEST SERVER] ' : ''

export const EMAIL_TEST_BANNER_HTML = IS_TEST_SERVER
  ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #92400e; font-size: 13px; font-weight: 700; margin: 0;">
        ⚠ TEST EMAIL — Development/Testing Server
      </p>
      <p style="color: #92400e; font-size: 12px; margin: 4px 0 0 0;">
        This is not a real notification. No action is required outside of training/testing exercises.
      </p>
    </div>`
  : ''

export const PDF_TEST_WATERMARK_HTML = IS_TEST_SERVER
  ? `<div style="position: fixed; top: 45%; left: 0; width: 100%; text-align: center; z-index: 999; pointer-events: none;">
      <span style="display: inline-block; transform: rotate(-35deg); font-size: 60px; font-weight: 900; color: rgba(220, 38, 38, 0.25); letter-spacing: 0.05em; white-space: nowrap;">
        TEST DOCUMENT — NOT VALID
      </span>
    </div>`
  : ''
