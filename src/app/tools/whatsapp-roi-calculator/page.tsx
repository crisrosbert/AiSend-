import { ToolPage, toolMetadata } from '@/components/tools/landing/tool-page'
import { CONTENT } from './content'
import { RoiHeroStage } from './hero-stage'
import { RoiTool } from './roi-tool'

export const metadata = toolMetadata(CONTENT)

export default function WhatsAppRoiCalculatorPage() {
  return <ToolPage content={CONTENT} tool={<RoiTool />} stage={<RoiHeroStage />} />
}
