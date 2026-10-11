import { ToolPage, toolMetadata } from '@/components/tools/landing/tool-page'
import { CONTENT } from './content'
import { TemplateHeroStage } from './hero-stage'
import { TemplateTool } from './template-tool'

export const metadata = toolMetadata(CONTENT)

export default function WhatsAppTemplateGeneratorPage() {
  return <ToolPage content={CONTENT} tool={<TemplateTool />} stage={<TemplateHeroStage />} />
}
