import { prisma } from '@/lib/prisma'
import { DEFAULT_SECTION_ITEMS, SECTION_LABELS, SECTION_2_KEYS } from '@/lib/clearance-config'

export type SectionTemplate = {
  id: string
  company_code: string
  section_key: string
  label: string
  phase: number
  sort_order: number
  items: {
    id: string
    company_code: string
    section_key: string
    item_key: string
    description: string
    sort_order: number
  }[]
}

async function attachItems(
  sections: Omit<SectionTemplate, 'items'>[],
  companyCode: string
): Promise<SectionTemplate[]> {
  const items = await prisma.clearanceItemTemplate.findMany({
    where: { company_code: companyCode },
    orderBy: { sort_order: 'asc' },
  })

  return sections.map((s) => ({
    ...s,
    items: items.filter((i) => i.section_key === s.section_key),
  }))
}

/**
 * Fetches clearance section templates for a given company.
 * Falls back to PL (1000) if no templates exist for the requested company.
 * Always includes the LINE_MANAGER section (programmatically injected).
 */
export async function getTemplatesForCompany(
  companyCode: string | null
): Promise<SectionTemplate[]> {
  const primaryCode = companyCode ?? '1000'

  const sections = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: primaryCode },
    orderBy: { sort_order: 'asc' },
  })

  let templatesWithItems: SectionTemplate[] = []

  if (sections.length > 0) {
    templatesWithItems = await attachItems(sections, primaryCode)
  } else if (primaryCode !== '1000') {
    // Fallback to PL (1000)
    const fallback = await prisma.clearanceSectionTemplate.findMany({
      where: { company_code: '1000' },
      orderBy: { sort_order: 'asc' },
    })
    templatesWithItems = await attachItems(fallback, '1000')
  }

  // Always inject LINE_MANAGER section if not already present
  const lineManagerExists = templatesWithItems.some((s) => s.section_key === 'LINE_MANAGER')
  if (!lineManagerExists) {
    const lineManagerItems = DEFAULT_SECTION_ITEMS['LINE_MANAGER'] || []
    const lineManagerTemplate: SectionTemplate = {
      id: `synthetic-line-manager-${primaryCode}`,
      company_code: primaryCode,
      section_key: 'LINE_MANAGER',
      label: SECTION_LABELS['LINE_MANAGER'] || 'Manager Clearance',
      phase: 2,
      sort_order: 0, // First in phase 2
      items: lineManagerItems.map((item, idx) => ({
        id: `synthetic-line-manager-item-${idx}`,
        company_code: primaryCode,
        section_key: 'LINE_MANAGER',
        item_key: item.item_key,
        description: item.description,
        sort_order: idx,
      })),
    }
    templatesWithItems.unshift(lineManagerTemplate)
  }

  return templatesWithItems
}
