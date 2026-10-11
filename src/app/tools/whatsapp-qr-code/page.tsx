import { ToolPage, toolMetadata } from '@/components/tools/landing/tool-page'
import { CONTENT } from './content'
import { QrHeroStage } from './hero-stage'
import { QrCodeTool } from './qr-code-tool'

export const metadata = toolMetadata(CONTENT)

export default function WhatsAppQrCodePage() {
  return <ToolPage content={CONTENT} tool={<QrCodeTool />} stage={<QrHeroStage />} />
}
