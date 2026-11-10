'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  FileText,
  GitBranch,
  Globe,
  Images,
  Link2,
  MessageSquare,
  MessageSquareReply,
  Package,
  Radio,
  Send,
  ShoppingCart,
  Sparkles,
  Tag,
  Timer,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'

/**
 * Shared header for every public page.
 *
 * Menu design:
 *  - "Product" is a mega menu: category tabs on top, a grid of items
 *    (icon + title + one-line description) below, and a promo card on the
 *    right.
 *  - Features / Industries / Resources are compact dropdowns with the same
 *    icon + title + description rows.
 *
 * Every href below points to a page that exists today (/signup, /tools/*,
 * /blog, /whatsapp-business-api, /contact). Items for features that do not
 * have a public page yet link to /signup. When you add a landing page for
 * one (see src/content/landing/index.ts), change that item's href here.
 *
 * `text-white` is written as `text-[#fff]` because globals.css remaps the
 * plain class to a dark colour.
 */

type Icon = ComponentType<{ className?: string }>

interface MenuItem {
  title: string
  desc: string
  href: string
  icon: Icon
}

interface MegaTab {
  id: string
  label: string
  heading: string
  icon: Icon
  items: MenuItem[]
}

const PRODUCT_TABS: MegaTab[] = [
  {
    id: 'agents',
    label: 'AI Agents',
    heading: 'AI Agents',
    icon: Bot,
    items: [
      { title: 'AI WhatsApp Agent', desc: 'Answers customers 24/7 from your own knowledge', href: '/signup', icon: Bot },
      { title: 'Website Chat Widget', desc: 'Same AI agent on your website', href: '/tools/ai-chatbot-widget', icon: MessageSquare },
      { title: 'Ads Agent', desc: 'Reply to click-to-WhatsApp ad leads instantly', href: '/signup', icon: Sparkles },
      { title: 'Lead Capture', desc: 'Collect name, phone and email inside the chat', href: '/signup', icon: UserPlus },
      { title: 'Appointment Booking', desc: 'Let the agent book slots in your open hours', href: '/signup', icon: Calendar },
      { title: 'Human Handoff', desc: 'Hand over to your team when needed', href: '/signup', icon: MessageSquareReply },
    ],
  },
  {
    id: 'broadcast',
    label: 'Broadcast & Marketing',
    heading: 'Broadcast & Marketing',
    icon: Radio,
    items: [
      { title: 'WhatsApp Broadcasts', desc: 'Send approved templates to thousands of contacts', href: '/signup', icon: Radio },
      { title: 'Campaign Agent', desc: 'AI plans the campaign and follow-ups for you', href: '/signup', icon: Sparkles },
      { title: 'Template Manager', desc: 'Create templates and track Meta approval', href: '/tools/whatsapp-template-generator', icon: FileText },
      { title: 'Media Library', desc: 'Images, PDFs and videos ready to send', href: '/signup', icon: Images },
      { title: 'Opt-in & Opt-out', desc: 'Consent handled the way Meta expects', href: '/signup', icon: Tag },
      { title: 'Wallet & Usage', desc: 'Pay per message, see every rupee spent', href: '/signup', icon: Wallet },
    ],
  },
  {
    id: 'crm',
    label: 'Inbox & CRM',
    heading: 'Inbox & CRM',
    icon: Users,
    items: [
      { title: 'Shared Team Inbox', desc: 'One inbox for your whole team', href: '/signup', icon: MessageSquare },
      { title: 'Contacts & Tags', desc: 'Segment customers and keep notes', href: '/signup', icon: Users },
      { title: 'Leads & Pipelines', desc: 'Move deals from first message to won', href: '/signup', icon: Briefcase },
      { title: 'Analytics', desc: 'Delivery, replies and conversions at a glance', href: '/signup', icon: BarChart3 },
      { title: 'Catalog & Orders', desc: 'Sell products inside WhatsApp', href: '/tools/whatsapp-catalog-builder', icon: ShoppingCart },
      { title: 'Multi-business', desc: 'Run several brands from one login', href: '/signup', icon: Building2 },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    heading: 'Automation',
    icon: GitBranch,
    items: [
      { title: 'Journeys', desc: 'Drag-and-drop WhatsApp chatbot flows', href: '/signup', icon: GitBranch },
      { title: 'Automations', desc: 'If this happens, do that. No code', href: '/signup', icon: Zap },
      { title: 'Appointment Reminders', desc: 'Cut no-shows with automatic reminders', href: '/signup', icon: Timer },
      { title: 'Website & Ads Leads', desc: 'Every lead lands in one place', href: '/signup', icon: Package },
      { title: 'WhatsApp Business API', desc: 'Official API access, set up for you', href: '/whatsapp-business-api', icon: Globe },
    ],
  },
]

const FEATURE_ITEMS: MenuItem[] = [
  { title: 'AI Agents', desc: 'Reply, qualify and book automatically', href: '/signup', icon: Bot },
  { title: 'WhatsApp Broadcasting', desc: 'Retarget and promote with templates', href: '/signup', icon: Radio },
  { title: 'Chatbot Flow Builder', desc: 'Drag and drop journeys', href: '/signup', icon: GitBranch },
  { title: 'Shared Inbox', desc: 'Team chat with assignment', href: '/signup', icon: MessageSquare },
  { title: 'Catalog', desc: 'Sell products on WhatsApp', href: '/tools/whatsapp-catalog-builder', icon: ShoppingCart },
  { title: 'Click-to-WhatsApp Links', desc: 'Free links and QR codes', href: '/tools/whatsapp-link-generator', icon: Link2 },
]

const INDUSTRY_ITEMS: MenuItem[] = [
  { title: 'Education', desc: 'Coaching, institutes, edtech', href: '/signup', icon: Users },
  { title: 'E-commerce', desc: 'D2C brands and online stores', href: '/signup', icon: ShoppingCart },
  { title: 'Healthcare', desc: 'Clinics and appointment booking', href: '/signup', icon: Calendar },
  { title: 'Real Estate', desc: 'Brokers, developers, site visits', href: '/signup', icon: Building2 },
  { title: 'Finance', desc: 'Fintech, loans, insurance', href: '/signup', icon: Wallet },
  { title: 'Agencies', desc: 'Manage many client accounts', href: '/signup', icon: Briefcase },
]

const RESOURCE_ITEMS: MenuItem[] = [
  { title: 'Blog', desc: 'Guides on WhatsApp marketing', href: '/blog', icon: FileText },
  { title: 'WhatsApp Business API Guide', desc: 'What it is and how to get it', href: '/whatsapp-business-api', icon: Globe },
  { title: 'Free WhatsApp Tools', desc: 'Link, QR, ROI and more', href: '/tools', icon: Sparkles },
  { title: 'ROI Calculator', desc: 'See what WhatsApp can earn you', href: '/tools/whatsapp-roi-calculator', icon: BarChart3 },
  { title: 'Bulk Sender', desc: 'Send many chats from your phone', href: '/tools/whatsapp-bulk-sender', icon: Send },
]

type MenuId = 'product' | 'features' | 'industries' | 'resources'

const CLOSE_DELAY_MS = 140

function ItemRow({ item, onNavigate }: { item: MenuItem; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group/item flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none transition-colors"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#1B6B4A] group-hover/item:bg-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 group-hover/item:text-[#1B6B4A]">{item.title}</span>
        <span className="block text-xs leading-snug text-gray-500">{item.desc}</span>
      </span>
    </Link>
  )
}

function PromoCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-emerald-50 to-sky-50 p-6 border border-emerald-100">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">New · AI Agents</p>
        <p className="mt-3 text-2xl font-extrabold leading-tight text-emerald-950">
          Let AI answer your WhatsApp chats while you sleep.
        </p>
        <p className="mt-2 text-sm text-gray-600">Broadcasts, inbox, CRM and AI agents in one place.</p>
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Link
          href="/signup"
          onClick={onNavigate}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1B6B4A] px-5 py-2.5 text-sm font-semibold text-[#fff] hover:bg-[#14523A] transition-colors"
        >
          Start for FREE <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/contact"
          onClick={onNavigate}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:border-[#1B6B4A] transition-colors"
        >
          Book a demo
        </Link>
      </div>
    </div>
  )
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [open, setOpen] = useState<MenuId | null>(null)
  const [tab, setTab] = useState<string>(PRODUCT_TABS[0].id)
  const [mobileSection, setMobileSection] = useState<MenuId | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  function openMenu(id: MenuId) {
    cancelClose()
    setOpen(id)
  }
  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS)
  }
  function closeAll() {
    cancelClose()
    setOpen(null)
    setMobileOpen(false)
  }

  // Escape closes; click outside closes (needed for touch / keyboard users).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null)
    }
    function onDown(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      cancelClose()
    }
  }, [])

  const activeTab = PRODUCT_TABS.find((t) => t.id === tab) ?? PRODUCT_TABS[0]

  const triggerClass = (id: MenuId) =>
    `flex items-center gap-1 py-6 text-base font-medium border-b-2 transition-colors ${
      open === id ? 'text-[#1B6B4A] border-[#1B6B4A]' : 'text-gray-800 border-transparent hover:text-[#1B6B4A]'
    }`

  function trigger(id: MenuId, label: string) {
    return (
      <button
        key={id}
        type="button"
        aria-haspopup="true"
        aria-expanded={open === id}
        className={triggerClass(id)}
        onClick={() => (open === id ? setOpen(null) : openMenu(id))}
        onFocus={() => openMenu(id)}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open === id ? 'rotate-180' : ''}`} />
      </button>
    )
  }

  function dropdown(id: MenuId, items: MenuItem[]) {
    if (open !== id) return null
    return (
      <div className="absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 rounded-xl border border-gray-100 bg-white p-2 shadow-xl">
        {items.map((it) => (
          <ItemRow key={it.title} item={it} onNavigate={closeAll} />
        ))}
      </div>
    )
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Utility bar */}
      <div className="hidden sm:block w-full border-b border-gray-200 bg-[#f4f9fc] text-gray-700 text-sm font-medium">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-end h-10 gap-6">
          <a className="inline-flex items-center gap-2 text-gray-800 hover:text-[#1B6B4A] transition-colors" href="https://wa.me/918707879485">
            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-gray-800">+91 8707879485 </span>
          </a>
          <a className="inline-flex items-center gap-2 text-gray-800 hover:text-[#1B6B4A] transition-colors" href="mailto:crisrosbert@gmail.com">
            <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-medium text-gray-800">crisrosbert@gmail.com</span>
          </a>
          <Link className="inline-flex items-center gap-2 text-[#fff] px-5 h-full font-semibold transition-colors bg-[#1B6B4A] hover:bg-[#14523A]" href="/contact">
            <span className="font-bold tracking-tight">Request a Call</span>
            <span className="text-sm font-bold">→</span>
          </Link>
        </div>
      </div>

      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link aria-label="AiSend Home" className="flex items-center focus:outline-none" href="/">
            <div className="flex items-center text-2xl font-black tracking-tight select-none">
              <span className="text-[#1B6B4A]">AI</span>
              <span className="text-emerald-950 ml-0.5">SEND</span>
              <span className="w-2 h-2 rounded-full bg-[#1B6B4A] ml-0.5 mt-1.5 inline-block" />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6" aria-label="Main">
            {/* Product: mega menu (panel is positioned against the header) */}
            <div onMouseEnter={() => openMenu('product')} onMouseLeave={scheduleClose}>
              {trigger("product", "Product")}
            </div>

            <div className="relative" onMouseEnter={() => openMenu('features')} onMouseLeave={scheduleClose}>
              {trigger("features", "Features")}
              {dropdown("features", FEATURE_ITEMS)}
            </div>

            <div className="relative" onMouseEnter={() => openMenu('industries')} onMouseLeave={scheduleClose}>
              {trigger("industries", "Industries")}
              {dropdown("industries", INDUSTRY_ITEMS)}
            </div>

            <div className="relative" onMouseEnter={() => openMenu('resources')} onMouseLeave={scheduleClose}>
              {trigger("resources", "Resources")}
              {dropdown("resources", RESOURCE_ITEMS)}
            </div>

            <Link className="py-6 text-base font-medium text-gray-800 hover:text-[#1B6B4A] transition-colors" href="/blog" onClick={closeAll}>Blog</Link>
            <Link className="py-6 text-base font-medium text-gray-800 hover:text-[#1B6B4A] transition-colors" href="/contact" onClick={closeAll}>Contact</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <Link className="text-sm font-semibold text-gray-700 hover:text-emerald-600 px-3 py-2 transition-colors" href="/login">
            Login
          </Link>
          <Link
            className="hidden sm:inline-flex items-center justify-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm hover:shadow transition-all duration-150"
            href="/signup"
          >
            Start for FREE
          </Link>
          <button
            aria-expanded={mobileOpen}
            aria-label="Toggle Navigation"
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={() => setMobileOpen((v) => !v)}
            type="button"
          >
            {mobileOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16m-7 6h7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Product mega panel (desktop) */}
      {open === 'product' && (
        <div
          className="hidden md:block absolute left-0 right-0 top-full border-t border-gray-100 bg-white shadow-xl"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            {/* Category tabs */}
            <div className="grid grid-cols-4 gap-3" role="tablist" aria-label="Product categories">
              {PRODUCT_TABS.map((t) => {
                const Icon = t.icon
                const active = t.id === activeTab.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onMouseEnter={() => setTab(t.id)}
                    onFocus={() => setTab(t.id)}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      active
                        ? 'border-emerald-200 bg-emerald-50 text-[#1B6B4A]'
                        : 'border-gray-200 bg-white text-gray-800 hover:border-emerald-200'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {t.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4 grid grid-cols-[1fr_300px] gap-5">
              <div className="rounded-2xl bg-[#eef7fb] p-5">
                <p className="px-3 pb-2 text-base font-bold text-gray-900">{activeTab.heading}</p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-1" role="tabpanel">
                  {activeTab.items.map((it) => (
                    <ItemRow key={it.title} item={it} onNavigate={closeAll} />
                  ))}
                </div>
              </div>
              <PromoCard onNavigate={closeAll} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden max-h-[75vh] overflow-y-auto border-t border-gray-100 bg-white px-4 sm:px-6 py-4 space-y-1">
          {(
            [
              ['product', 'Product', PRODUCT_TABS.flatMap((t) => t.items)],
              ['features', 'Features', FEATURE_ITEMS],
              ['industries', 'Industries', INDUSTRY_ITEMS],
              ['resources', 'Resources', RESOURCE_ITEMS],
            ] as Array<[MenuId, string, MenuItem[]]>
          ).map(([id, label, items]) => (
            <div key={id}>
              <button
                type="button"
                aria-expanded={mobileSection === id}
                onClick={() => setMobileSection(mobileSection === id ? null : id)}
                className="flex w-full items-center justify-between px-2 py-2.5 text-base font-medium text-gray-800"
              >
                {label}
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileSection === id ? 'rotate-180' : ''}`} />
              </button>
              {mobileSection === id && (
                <div className="pb-2">
                  {dedupe(items).map((it) => (
                    <ItemRow key={it.title} item={it} onNavigate={closeAll} />
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link className="block px-2 py-2.5 text-gray-800 font-medium text-base hover:text-[#1B6B4A]" href="/blog" onClick={closeAll}>Blog</Link>
          <Link className="block px-2 py-2.5 text-gray-800 font-medium text-base hover:text-[#1B6B4A]" href="/contact" onClick={closeAll}>Contact</Link>
          <div className="pt-3 mt-2 border-t border-gray-100 flex flex-col gap-2">
            <Link className="text-center text-sm font-semibold text-gray-700 px-3 py-2.5 rounded-lg border border-gray-200" href="/login" onClick={closeAll}>
              Login
            </Link>
            <Link className="text-center bg-[#1B6B4A] hover:bg-[#14523A] text-[#fff] text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm" href="/signup" onClick={closeAll}>
              Start for FREE
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

function dedupe(items: MenuItem[]): MenuItem[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.title) ? false : (seen.add(i.title), true)))
}
