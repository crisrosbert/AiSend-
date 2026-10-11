import { ToolPage, toolMetadata } from '@/components/tools/landing/tool-page'
import { CONTENT } from './content'
import { WidgetHeroStage } from './hero-stage'
import { ChatWidgetTool } from './widget-tool'

export const metadata = toolMetadata(CONTENT)

export default function WhatsAppChatWidgetPage() {
  return <ToolPage content={CONTENT} tool={<ChatWidgetTool />} stage={<WidgetHeroStage />} />
}
