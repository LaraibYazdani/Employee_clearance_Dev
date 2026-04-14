import { prisma } from '@/lib/prisma'

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
 */
export async function getTemplatesForCompany(
  companyCode: string | null
): Promise<SectionTemplate[]> {
  const primaryCode = companyCode ?? '1000'

  const sections = await prisma.clearanceSectionTemplate.findMany({
    where: { company_code: primaryCode },
    orderBy: { sort_order: 'asc' },
  })

  if (sections.length > 0) return attachItems(sections, primaryCode)

  // Fallback to PL (1000)
  if (primaryCode !== '1000') {
    const fallback = await prisma.clearanceSectionTemplate.findMany({
      where: { company_code: '1000' },
      orderBy: { sort_order: 'asc' },
    })
    return attachItems(fallback, '1000')
  }

  return []
}
