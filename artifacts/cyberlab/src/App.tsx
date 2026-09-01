import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, RedirectToSignIn, Show, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowLeft, ArrowRight, Award, BookOpen, Box, Check, CheckCircle2, ChevronDown,
  Clipboard, Code2, Command, Database, Download, ExternalLink, FileText, Filter, Flame,
  Gauge, GraduationCap, Hexagon, Home, Layers3, Library, LockKeyhole, LogOut, Menu, MoreHorizontal,
  Play, Plus, Radio, RefreshCw, Search, Server, Settings, Shield, SlidersHorizontal, Sparkles,
  Terminal, Trash2, Trophy, UserRound, Users, X, Zap,
} from 'lucide-react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  useCreateLab, useDeleteLab, useGetAdminOverview, useGetCommand, useGetCurrentUser,
  useGetDashboard, useGetLab, useGetLearningModule, useGetProgress, useListAchievements,
  useListCommands, useListLabInstances, useListLabs, useListLearningModules, useListUsers,
  useStartLab, useSubmitFlag, useUpdateLab,
} from '@workspace/api-client-react';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import type { Command as CommandType, Lab, LabDetail, LearningModule, LearningModuleDetail, User } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#2eb79f',
    colorForeground: '#183238',
    colorMutedForeground: '#6d8580',
    colorDanger: '#c85c4a',
    colorBackground: '#f7f8f5',
    colorInput: '#ffffff',
    colorInputForeground: '#183238',
    colorNeutral: '#d7e1dc',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.55rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#f7f8f5] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#183238] font-extrabold',
    headerSubtitle: 'text-[#6d8580]',
    socialButtonsBlockButtonText: 'text-[#183238]',
    formFieldLabel: 'text-[#183238]',
    footerActionLink: 'text-[#2b8f80] font-bold',
    footerActionText: 'text-[#6d8580]',
    dividerText: 'text-[#6d8580]',
    identityPreviewEditButton: 'text-[#2b8f80]',
    formFieldSuccessText: 'text-[#2b8f80]',
    alertText: 'text-[#c85c4a]',
    logoBox: 'mb-4',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d7e1dc] bg-white hover:bg-[#edf4ef]',
    formButtonPrimary: 'bg-[#2eb79f] text-[#183238] hover:bg-[#42c7ad]',
    formFieldInput: 'border-[#d7e1dc] bg-white text-[#183238]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#d7e1dc]',
    alert: 'border-[#e8b2a7] bg-[#fff4f1]',
    otpCodeFieldInput: 'border-[#d7e1dc] bg-white',
    formFieldRow: 'mb-4',
    main: 'px-2',
  },
};

const navStudent = [
  { href: '/dashboard', label: 'Overview', icon: Home },
  { href: '/labs', label: 'Lab library', icon: Terminal },
  { href: '/learning', label: 'Learning path', icon: BookOpen },
  { href: '/commands', label: 'Command reference', icon: Command },
];
const navPersonal = [
  { href: '/progress', label: 'Progress', icon: Gauge },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
];
const navAdmin = [
  { href: '/admin', label: 'Admin overview', icon: Activity },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/labs', label: 'Labs', icon: Layers3 },
  { href: '/admin/commands', label: 'Commands', icon: Command },
  { href: '/admin/categories', label: 'Categories', icon: Database },
  { href: '/admin/learning', label: 'Learning', icon: BookOpen },
  { href: '/admin/lab-instances', label: 'Lab instances', icon: Radio },
  { href: '/admin/reports', label: 'Reports', icon: FileText },
  { href: '/admin/settings', label: 'Platform settings', icon: Settings },
];

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
    <span className="brand-mark">C</span>
    <span className={`font-extrabold tracking-[-.04em] text-[15px] ${light ? 'text-[#edf1e9]' : ''}`}>CYBER<span className="text-[#ee795c]">LAB</span></span>
  </Link>;
}

function StatePanel({ kind = 'empty', title, body, retry }: { kind?: 'empty' | 'error'; title: string; body: string; retry?: () => void }) {
  return <div className="panel p-12 text-center fade-up" data-testid={`state-${kind}`}>
    {kind === 'error' ? <X className="mx-auto mb-4 text-[hsl(var(--destructive))]" size={28} /> : <Hexagon className="mx-auto mb-4 text-[hsl(var(--primary))]" size={28} />}
    <h3 className="font-extrabold text-lg">{title}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{body}</p>
    {retry && <button className="btn btn-outline mt-5" onClick={retry} data-testid="button-retry"><RefreshCw size={14} /> Try again</button>}
  </div>;
}

function LoadingRows({ count = 3 }: { count?: number }) {
  return <div className="space-y-3" data-testid="loading-state">{Array.from({ length: count }).map((_, i) => <div key={i} className="panel p-5 flex gap-4"><div className="skeleton h-9 w-9" /><div className="flex-1"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-3 w-2/3 mt-3" /></div></div>)}</div>;
}

function Avatar({ user, size = 'md' }: { user?: Partial<User> | null; size?: 'sm' | 'md' }) {
  const initials = (user?.name || 'Student').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return <div className={`grid place-items-center rounded-full bg-[#d7ebe4] text-[#236c62] font-extrabold ${size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs'}`} data-testid="img-avatar">{initials}</div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser();
  const { signOut } = useClerk();
  const [mobile, setMobile] = useState(false);
  const isAdmin = location.startsWith('/admin');
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand light />
      <div className="mt-10">
        <div className="nav-label">Workspace</div>
        {navStudent.map(item => <NavItem key={item.href} {...item} active={location === item.href || (item.href === '/labs' && location.startsWith('/labs/'))} />)}
        <div className="nav-label">Your signal</div>
        {navPersonal.map(item => <NavItem key={item.href} {...item} active={location === item.href} />)}
        <div className="nav-label">Control room</div>
        {navAdmin.slice(0, isAdmin ? navAdmin.length : 1).map(item => <NavItem key={item.href} {...item} active={location === item.href} />)}
      </div>
      <div className="mt-auto border-t border-white/10 pt-4">
        <NavItem href="/profile" label="Profile" icon={UserRound} active={location === '/profile'} />
        <NavItem href="/settings" label="Settings" icon={Settings} active={location === '/settings'} />
        <button className="nav-item w-full mt-1" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-log-out"><LogOut size={15} /> Sign out</button>
      </div>
    </aside>
    {mobile && <div className="fixed inset-0 z-30 bg-[#183238]/40 md:hidden" onClick={() => setMobile(false)}><aside className="sidebar !flex h-full w-[252px]" onClick={e => e.stopPropagation()}><Brand light /><div className="mt-10">{navStudent.map(item => <NavItem key={item.href} {...item} active={location === item.href} />)}</div></aside></div>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu border-0 bg-transparent" onClick={() => setMobile(true)} data-testid="button-open-menu"><Menu size={20} /></button>
        <div className="hidden md:block font-mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">
          {isAdmin ? 'Control room / platform operations' : 'Student console / practice mode'}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-[hsl(var(--muted-foreground))]"><span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" />SYSTEM ONLINE</span>
          <Link href="/profile" className="flex items-center gap-2" data-testid="link-top-profile"><Avatar user={user} size="sm" /><span className="hidden lg:block text-xs font-bold">{user?.name || 'Student'}</span></Link>
        </div>
      </header>
      {children}
    </main>
  </div>;
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active?: boolean }) {
  return <Link href={href} className={`nav-item ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={15} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span></Link>;
}

function PageHeader({ eyebrow, title, body, action }: { eyebrow: string; title: string; body?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end fade-up"><div><div className="eyebrow mb-3">{eyebrow}</div><h1 className="display text-4xl font-extrabold">{title}</h1>{body && <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">{body}</p>}</div>{action}</div>;
}

function Stat({ label, value, detail, icon: Icon, accent = 'teal' }: { label: string; value: string | number; detail: string; icon: typeof Flame; accent?: 'teal' | 'orange' }) {
  return <div className="panel panel-hover p-5" data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><span className="eyebrow text-[hsl(var(--muted-foreground))]">{label}</span><span className={`rounded-md p-2 ${accent === 'orange' ? 'bg-[hsl(var(--accent)/.12)] text-[hsl(var(--accent))]' : 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]'}`}><Icon size={16} /></span></div><div className="mt-5 text-3xl font-extrabold tracking-[-.06em]">{value}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{detail}</div></div>;
}

function Landing() {
  return <div className="landing">
    <nav><Brand light /><div className="flex items-center gap-3"><Link href="/login" className="hidden sm:inline-flex rounded-md px-4 py-2 text-xs font-bold text-[#aacbc2]" data-testid="link-landing-login">Sign in</Link><Link href="/register" className="btn bg-[#ee795c] px-4 py-2.5 text-[#183238]" data-testid="link-landing-register">Start training <ArrowRight size={14} /></Link></div></nav>
    <section className="hero hero-grid">
      <div className="relative z-[1] max-w-[680px]">
        <div className="metric-line mb-7">FIELD TRAINING PLATFORM / 01</div>
        <h1 className="display text-[82px] font-extrabold leading-[.91] text-[#edf1e9]">Think like<br /><span className="text-[#ee795c]">a defender.</span></h1>
        <p className="mt-8 max-w-[470px] text-[16px] leading-7 text-[#a9c6bf]">CyberLab turns security theory into muscle memory. Work real scenarios, read the signal, and build the instincts that hold under pressure.</p>
        <div className="mt-10 flex flex-wrap gap-3"><Link href="/register" className="btn bg-[#edf1e9] px-5 py-3 text-[#183238]" data-testid="link-hero-start">Enter the lab <ArrowRight size={15} /></Link><Link href="/labs" className="btn border border-[#466963] bg-transparent px-5 py-3 text-[#edf1e9]" data-testid="link-hero-explore">Explore scenarios</Link></div>
      </div>
      <div className="relative z-[1] mt-24 grid max-w-[630px] grid-cols-3 border-t border-[#466963] pt-5">
        <div><div className="text-3xl font-extrabold text-[#edf1e9]">42</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#79aaa1]">Hands-on labs</div></div>
        <div><div className="text-3xl font-extrabold text-[#edf1e9]">08</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#79aaa1]">Skill tracks</div></div>
        <div><div className="text-3xl font-extrabold text-[#edf1e9]">24/7</div><div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-[#79aaa1]">Practice window</div></div>
      </div>
    </section>
    <section className="mx-auto grid max-w-[1200px] gap-px border-x border-[#33535a] bg-[#33535a] md:grid-cols-3">
      {[['01', 'Read the signal', 'Learn to separate noise from the indicators that matter.'], ['02', 'Operate with intent', 'Every command, query, and decision has a consequence.'], ['03', 'Prove your work', 'Flags, streaks, and milestones make progress visible.']].map(([n, title, body]) => <div className="bg-[#183238] p-8" key={n}><div className="font-mono text-xs text-[#ee795c]">{n}</div><h2 className="mt-12 text-lg font-extrabold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#91b4ac]">{body}</p></div>)}
    </section>
    <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-7 py-8 text-[10px] font-mono uppercase tracking-widest text-[#6d9890]"><span>CyberLab / train deliberately</span><span>Built for the next shift</span></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  return <div className="grid min-h-[100dvh] bg-[#183238] lg:grid-cols-[.9fr_1.1fr]">
    <div className="hidden flex-col justify-between p-10 text-[#edf1e9] lg:flex"><Brand light /><div><div className="metric-line mb-6">SECURE ACCESS / 00</div><h1 className="display max-w-[470px] text-6xl font-extrabold">Your next<br /><span className="text-[#ee795c]">shift starts here.</span></h1><p className="mt-6 max-w-sm text-sm leading-6 text-[#91b4ac]">A focused console for learning the habits that make good operators.</p></div><div className="font-mono text-[10px] uppercase tracking-widest text-[#6d9890]">Encrypted training environment</div></div>
    <div className="flex items-center justify-center bg-[hsl(var(--background))] px-6 py-10"><div className="w-full max-w-[440px]"><div className="mb-10 lg:hidden"><Brand /></div><div className="eyebrow mb-3">{mode === 'login' ? 'Welcome back' : 'New operator'}</div><h1 className="display text-4xl font-extrabold">{mode === 'login' ? 'Resume your work.' : 'Set up your console.'}</h1><p className="mb-8 mt-3 text-sm text-[hsl(var(--muted-foreground))]">{mode === 'login' ? 'Sign in to continue your training sequence.' : 'Create a student account and start with a live scenario.'}</p>{mode === 'login' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} />}</div></div>
  </div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const nextUser = user?.id ?? null;
    if (previousUser.current !== undefined && previousUser.current !== nextUser) client.clear();
    previousUser.current = nextUser;
  }), [addListener, client]);
  return null;
}

function SignInPage() {
  return <AuthPage mode="login" />;
}

function SignUpPage() {
  return <AuthPage mode="register" />;
}

function HomeRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  if (isLoading) return <Page><PageHeader eyebrow="Overview" title="Loading your console." /><LoadingRows count={4} /></Page>;
  if (isError || !data) return <Page><PageHeader eyebrow="Overview" title="Signal unavailable." /><StatePanel kind="error" title="Dashboard failed to load" body="We could not retrieve your training signal." retry={refetch} /></Page>;
  return <Page><PageHeader eyebrow={`Good morning, ${data.user.name.split(' ')[0]}`} title="Your next move is clear." body="Keep the loop tight: study the pattern, enter the lab, verify the flag." action={<Link href="/labs" className="btn btn-primary" data-testid="link-dashboard-labs">Browse labs <ArrowRight size={14} /></Link>} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[
      ['Labs completed', data.stats.labsCompleted, `${data.stats.labsAvailable} available`, CheckCircle2], ['Current streak', `${data.stats.currentStreak}d`, 'Keep the chain alive', Flame], ['Commands learned', data.stats.commandsLearned, 'Across your reference', Command], ['Overall progress', `${data.stats.overallProgress}%`, 'Training sequence', Gauge], ['Signal status', 'LIVE', 'Practice ready', Radio],
    ].map(([label, value, detail, Icon], i) => <Stat key={String(label)} label={String(label)} value={value as string} detail={String(detail)} icon={Icon as typeof Flame} accent={i === 1 ? 'orange' : 'teal'} />)}</div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
      <section className="panel overflow-hidden" data-testid="panel-continue-learning"><div className="border-b border-[hsl(var(--border))] px-6 py-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Resume sequence</div><h2 className="mt-2 text-lg font-extrabold">{data.continueLearning.title}</h2></div><span className="tag tag-teal">{data.continueLearning.level}</span></div><p className="mt-2 max-w-lg text-sm text-[hsl(var(--muted-foreground))]">{data.continueLearning.description}</p></div><div className="p-6"><div className="mb-3 flex justify-between text-[11px] font-mono"><span>{data.continueLearning.completedLessons} / {data.continueLearning.lessonCount} lessons</span><span className="text-[hsl(var(--primary))]">{data.continueLearning.progress}%</span></div><div className="progress-track"><div className="progress-bar" style={{ width: `${data.continueLearning.progress}%` }} /></div><Link href={`/learning/${data.continueLearning.id}`} className="btn btn-primary mt-6" data-testid="link-resume-learning">Resume module <ArrowRight size={14} /></Link></div></section>
      <section className="panel p-6" data-testid="panel-activity"><div className="flex items-center justify-between"><div className="eyebrow">Recent activity</div><Activity size={16} className="text-[hsl(var(--muted-foreground))]" /></div><div className="mt-5 space-y-5">{data.recentActivity?.length ? data.recentActivity.slice(0, 4).map(item => <div className="flex gap-3" key={item.id} data-testid={`activity-${item.id}`}><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--accent))]" /><div><div className="text-xs font-bold">{item.title}</div><div className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">{item.description}</div><div className="mt-1 font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{item.timestamp}</div></div></div>) : <p className="text-sm text-[hsl(var(--muted-foreground))]">No activity recorded yet.</p>}</div></section>
    </div>
    <section className="mt-8"><div className="mb-4 flex items-end justify-between"><div><div className="eyebrow">Recommended next</div><h2 className="mt-2 text-xl font-extrabold">Scenarios worth your attention</h2></div><Link href="/labs" className="text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-all-recommendations">View all</Link></div><div className="grid gap-4 md:grid-cols-3">{data.recommendedLabs?.slice(0, 3).map(lab => <LabCard key={lab.id} lab={lab} />)}</div></section>
  </Page>;
}

function Page({ children }: { children: ReactNode }) { return <div className="content">{children}</div>; }

function LabCard({ lab }: { lab: Lab }) {
  return <Link href={`/labs/${lab.id}`} className="panel panel-hover block overflow-hidden" data-testid={`card-lab-${lab.id}`}><div className="h-1.5" style={{ background: lab.accent || '#2eb79f' }} /><div className="p-5"><div className="flex items-start justify-between gap-3"><span className="tag">{lab.category.name}</span><span className={`tag ${lab.difficulty === 'Hard' ? 'tag-orange' : ''}`}>{lab.difficulty}</span></div><h3 className="mt-5 text-[15px] font-extrabold">{lab.name}</h3><p className="mt-2 line-clamp-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{lab.description}</p><div className="mt-6 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-[10px] font-mono text-[hsl(var(--muted-foreground))]"><span>{lab.estimatedMinutes} MIN / {lab.objectiveCount || 0} OBJECTIVES</span>{lab.completed ? <span className="flex items-center gap-1 text-[hsl(var(--primary))]"><Check size={12} /> COMPLETE</span> : <span>{lab.progress || 0}%</span>}</div></div></Link>;
}

function Labs() {
  const [search, setSearch] = useState(''); const [difficulty, setDifficulty] = useState('');
  const { data, isLoading, isError, refetch } = useListLabs({ search: search || undefined, difficulty: difficulty ? difficulty as 'Easy' | 'Medium' | 'Hard' : undefined });
  return <Page><PageHeader eyebrow="Scenario library" title="Choose your pressure." body="Published labs built to sharpen one decision at a time." action={<button className="btn btn-outline" onClick={() => { setSearch(''); setDifficulty(''); }} data-testid="button-clear-filters"><X size={14} /> Clear filters</button>} />
    <div className="panel mb-6 flex flex-col gap-3 p-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={15} /><input className="input pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scenarios, techniques, objectives..." data-testid="input-search-labs" /></div><select className="input sm:w-40" value={difficulty} onChange={e => setDifficulty(e.target.value)} data-testid="select-lab-difficulty"><option value="">All difficulty</option><option>Easy</option><option>Medium</option><option>Hard</option></select><button className="btn btn-quiet" data-testid="button-filter-labs"><Filter size={14} /> Filter</button></div>
    {isLoading ? <LoadingRows count={4} /> : isError ? <StatePanel kind="error" title="Library signal lost" body="The lab catalog could not be loaded." retry={refetch} /> : data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map(lab => <LabCard key={lab.id} lab={lab} />)}</div> : <StatePanel title="No scenarios match" body="Try a broader term or clear the current filters." />}
  </Page>;
}

function LabDetailPage() {
  const { id = '' } = useParams(); const { data, isLoading, isError, refetch } = useGetLab(id);
  const [, setLocation] = useLocation(); const start = useStartLab();
  if (isLoading) return <Page><LoadingRows count={4} /></Page>;
  if (isError || !data) return <Page><StatePanel kind="error" title="Scenario unavailable" body="This lab may have moved or is not published." retry={refetch} /></Page>;
  const lab = data as LabDetail;
  return <Page><Link href="/labs" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-labs"><ArrowLeft size={14} /> Back to library</Link><div className="grid gap-8 lg:grid-cols-[1.25fr_.75fr]"><div><div className="eyebrow mb-4">{lab.category.name} / {lab.difficulty}</div><h1 className="display max-w-3xl text-5xl font-extrabold">{lab.name}</h1><p className="mt-5 max-w-2xl text-[15px] leading-7 text-[hsl(var(--muted-foreground))]">{lab.description}</p><div className="mt-7 flex flex-wrap gap-2"><span className="tag">{lab.estimatedMinutes} MIN ESTIMATE</span><span className="tag">{lab.objectiveCount || lab.objectives.length} OBJECTIVES</span><span className={`tag ${lab.docker.configured ? 'tag-teal' : 'tag-orange'}`}>{lab.docker.configured ? 'DOCKER READY' : 'DOCKER NOT CONFIGURED'}</span></div><section className="mt-12"><div className="eyebrow mb-4">Objectives</div><div className="space-y-3">{lab.objectives.map((objective, i) => <div key={i} className="panel flex gap-4 p-4" data-testid={`objective-${i}`}><span className="font-mono text-xs text-[hsl(var(--accent))]">0{i + 1}</span><span className="text-sm leading-6">{objective}</span></div>)}</div></section></div><aside className="panel h-fit p-6 lg:sticky lg:top-24"><div className="flex items-center justify-between"><span className="eyebrow">Mission brief</span><Shield size={18} className="text-[hsl(var(--primary))]" /></div><div className="mt-6 space-y-5"><Info label="Requirements" value={lab.requirements?.join(', ') || 'No prerequisites'} /><Info label="Time limit" value={`${lab.docker.timeoutMinutes} minutes`} /><Info label="Network" value={lab.docker.network || 'Isolated'} /></div><button className="btn btn-primary mt-8 w-full py-3" disabled={start.isPending} onClick={() => start.mutate({ id: lab.id }, { onSuccess: instance => setLocation(`/labs/${lab.id}/workspace`) })} data-testid="button-start-lab">{start.isPending ? 'Provisioning...' : 'Start scenario'} <Play size={14} /></button><p className="mt-3 text-center text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">A secure instance will be assigned to your session.</p></aside></div></Page>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><div className="eyebrow text-[hsl(var(--muted-foreground))]">{label}</div><div className="mt-1 text-sm font-bold">{value}</div></div>; }

function Workspace() {
  const { id = '' } = useParams(); const { data: lab } = useGetLab(id); const start = useStartLab(); const submit = useSubmitFlag(); const [flag, setFlag] = useState(''); const [result, setResult] = useState<{ correct: boolean; message: string } | null>(null);
  const detail = lab as LabDetail | undefined;
  return <Page><Link href={`/labs/${id}`} className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-lab-detail"><ArrowLeft size={14} /> Mission brief</Link><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="eyebrow mb-3">Assigned workspace / {id}</div><h1 className="display text-4xl font-extrabold">{detail?.name || 'Lab workspace'}</h1></div><span className="tag tag-orange"><span className="mr-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" /> TERMINAL PENDING</span></div><div className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]"><div className="space-y-6"><div className="terminal min-h-[310px] overflow-hidden" data-testid="panel-terminal-pending"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[10px] text-[#77948f]"><span className="h-2 w-2 rounded-full bg-[#e87158]" /><span className="h-2 w-2 rounded-full bg-[#d9af59]" /><span className="h-2 w-2 rounded-full bg-[#5eb09c]" /><span className="ml-3">cyberlab-session / terminal</span></div><div className="p-6 text-[12px] leading-7"><div className="muted-line">$ initializing secure workspace...</div><div className="muted-line">$ checking docker configuration...</div><div className="mt-3 text-[#e87158]">! terminal integration pending</div><div className="mt-4 max-w-md leading-6 text-[#9ccbc0]">This lab does not have a configured Docker target yet. You can still review the objectives and submit a flag once you have completed the exercise externally.</div><div className="mt-6 text-[#d4e9df]"><span className="text-[#e87158]">operator@cyberlab</span>:<span className="text-[#d9af59]">~/workspace</span>$ <span className="animate-pulse">_</span></div></div></div><div className="panel p-6"><div className="eyebrow">Instructions</div><p className="mt-4 whitespace-pre-line text-sm leading-7 text-[hsl(var(--muted-foreground))]">{detail?.instructions || 'Review the mission brief, then work through the objectives in order.'}</p></div></div><aside className="space-y-6"><div className="panel p-6"><div className="flex items-center justify-between"><div className="eyebrow">Submit flag</div><LockKeyhole size={16} className="text-[hsl(var(--primary))]" /></div><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">When you have the answer, submit the exact flag value for verification.</p><form className="mt-5" onSubmit={e => { e.preventDefault(); submit.mutate({ id, data: { value: flag } }, { onSuccess: r => { setResult(r); setFlag(''); } }); }}><input className="input font-mono" value={flag} onChange={e => setFlag(e.target.value)} required placeholder="CLAB{...}" data-testid="input-flag" /><button className="btn btn-primary mt-3 w-full" disabled={submit.isPending} data-testid="button-submit-flag">{submit.isPending ? 'Verifying...' : 'Verify flag'} <Check size={14} /></button></form>{result && <div className={`mt-4 rounded-md p-3 text-xs ${result.correct ? 'bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]'}`} data-testid="status-flag-result">{result.message}</div>}</div><div className="panel p-6"><div className="eyebrow">Objectives</div><div className="mt-4 space-y-3">{detail?.objectives?.map((o, i) => <div className="flex gap-3 text-xs leading-5" key={i}><span className="font-mono text-[hsl(var(--accent))]">0{i + 1}</span><span>{o}</span></div>)}</div></div></aside></div></Page>;
}

function Commands() {
  const [search, setSearch] = useState(''); const { data, isLoading, isError, refetch } = useListCommands({ search: search || undefined });
  return <Page><PageHeader eyebrow="Command reference" title="Use the right tool." body="A compact field guide for the commands you will reach for under pressure." /><div className="panel mb-6 flex items-center gap-3 p-3"><Search size={16} className="ml-2 text-[hsl(var(--muted-foreground))]" /><input className="input border-0 bg-transparent p-2 shadow-none focus:shadow-none" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by command, tool, OS, or intent..." data-testid="input-search-commands" /></div>{isLoading ? <LoadingRows /> : isError ? <StatePanel kind="error" title="Reference unavailable" body="The command index could not be loaded." retry={refetch} /> : data?.length ? <div className="panel divide-y divide-[hsl(var(--border))]">{data.map(command => <CommandRow key={command.id} command={command} />)}</div> : <StatePanel title="No commands found" body="Try searching for a tool like grep, curl, or nmap." />}</Page>;
}

function CommandRow({ command }: { command: CommandType }) { return <Link href={`/commands/${command.id}`} className="flex flex-col gap-4 p-5 transition-colors hover:bg-[hsl(var(--muted)/.5)] sm:flex-row sm:items-center sm:justify-between" data-testid={`row-command-${command.id}`}><div className="flex min-w-0 items-center gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e3eee9] text-[hsl(var(--primary))]"><Terminal size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold">{command.name}</h3><span className="tag">{command.tool}</span></div><p className="mt-1 truncate font-mono text-[11px] text-[hsl(var(--muted-foreground))]">{command.command}</p></div></div><div className="flex items-center gap-4 pl-14 text-[10px] font-mono text-[hsl(var(--muted-foreground))] sm:pl-0"><span>{command.operatingSystem}</span><span className="tag">{command.difficulty}</span><ArrowRight size={14} /></div></Link>; }

function CommandDetail() { const { id = '' } = useParams(); const { data, isLoading, isError, refetch } = useGetCommand(id); const [copied, setCopied] = useState(false); if (isLoading) return <Page><LoadingRows count={2} /></Page>; if (isError || !data) return <Page><StatePanel kind="error" title="Command unavailable" body="This entry could not be found." retry={refetch} /></Page>; const copy = () => { navigator.clipboard?.writeText(data.command); setCopied(true); setTimeout(() => setCopied(false), 1800); }; return <Page><Link href="/commands" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-commands"><ArrowLeft size={14} /> Back to reference</Link><div className="max-w-4xl"><div className="eyebrow mb-4">{data.tool} / {data.category}</div><h1 className="display text-5xl font-extrabold">{data.name}</h1><p className="mt-5 max-w-2xl text-[15px] leading-7 text-[hsl(var(--muted-foreground))]">{data.description}</p><div className="terminal mt-8 flex items-center justify-between gap-4 p-5"><code className="overflow-x-auto text-xs">{data.command}</code><button className="shrink-0 rounded-md border border-white/15 p-2 text-[#b5eee0] hover:bg-white/10" onClick={copy} data-testid="button-copy-command">{copied ? <Check size={15} /> : <Clipboard size={15} />}</button></div><div className="mt-8 grid gap-6 md:grid-cols-2"><section className="panel p-6"><div className="eyebrow">Options</div><div className="mt-4 divide-y divide-[hsl(var(--border))]">{data.options?.length ? data.options.map((o, i) => <div className="grid grid-cols-[85px_1fr] gap-3 py-3 text-xs" key={i}><code className="font-mono text-[hsl(var(--accent))]">{o.flag}</code><span className="text-[hsl(var(--muted-foreground))]">{o.description}</span></div>) : <p className="py-3 text-sm text-[hsl(var(--muted-foreground))]">No options documented.</p>}</div></section><section className="panel p-6"><div className="eyebrow">Example</div><pre className="mt-4 overflow-auto whitespace-pre-wrap rounded-md bg-[hsl(var(--secondary))] p-4 font-mono text-xs leading-6">{data.example}</pre><div className="mt-6 flex flex-wrap gap-2"><span className="tag">{data.operatingSystem}</span><span className="tag">{data.difficulty}</span></div></section></div></div></Page>; }

function Learning() { const { data, isLoading, isError, refetch } = useListLearningModules(); return <Page><PageHeader eyebrow="Learning path" title="Build the mental model." body="Short lessons that make the next lab feel less like a guess." /><div className="mb-7 flex gap-3 overflow-auto">{['All modules', 'Foundations', 'Defensive operations', 'Offensive fundamentals'].map((x, i) => <button key={x} className={`btn whitespace-nowrap ${i === 0 ? 'btn-primary' : 'btn-outline'}`} data-testid={`button-learning-filter-${i}`}>{x}</button>)}</div>{isLoading ? <LoadingRows count={4} /> : isError ? <StatePanel kind="error" title="Learning path unavailable" body="Modules could not be retrieved." retry={refetch} /> : data?.length ? <div className="grid gap-4 md:grid-cols-2">{data.map(module => <ModuleCard key={module.id} module={module} />)}</div> : <StatePanel title="No modules yet" body="Your learning path will appear when modules are published." />}</Page>; }

function ModuleCard({ module }: { module: LearningModule }) { return <Link href={`/learning/${module.id}`} className="panel panel-hover block p-6" data-testid={`card-module-${module.id}`}><div className="flex items-start justify-between"><span className="tag tag-teal">{module.level}</span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{module.lessonCount} LESSONS</span></div><h2 className="mt-8 text-lg font-extrabold">{module.title}</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{module.description}</p><div className="mt-7 flex items-center justify-between text-[11px] font-mono"><span>{module.completedLessons} / {module.lessonCount} complete</span><span className="text-[hsl(var(--primary))]">{module.progress}%</span></div><div className="progress-track mt-2"><div className="progress-bar" style={{ width: `${module.progress}%`, background: module.accent || undefined }} /></div></Link>; }

function LearningDetail() { const { id = '' } = useParams(); const { data, isLoading, isError, refetch } = useGetLearningModule(id); if (isLoading) return <Page><LoadingRows count={3} /></Page>; if (isError || !data) return <Page><StatePanel kind="error" title="Module unavailable" body="This learning sequence could not be loaded." retry={refetch} /></Page>; const module = data as LearningModuleDetail; return <Page><Link href="/learning" className="mb-7 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-back-learning"><ArrowLeft size={14} /> Back to learning path</Link><div className="grid gap-8 lg:grid-cols-[1fr_330px]"><div><div className="eyebrow mb-4">{module.category} / {module.level}</div><h1 className="display text-5xl font-extrabold">{module.title}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">{module.description}</p><div className="panel mt-8 p-6"><div className="flex justify-between text-xs font-mono"><span>MODULE PROGRESS</span><span className="text-[hsl(var(--primary))]">{module.progress}%</span></div><div className="progress-track mt-3"><div className="progress-bar" style={{ width: `${module.progress}%` }} /></div></div><div className="mt-8 space-y-2">{module.lessons?.sort((a, b) => a.position - b.position).map((lesson, i) => <div className="panel flex items-center gap-4 p-4" key={lesson.id} data-testid={`lesson-${lesson.id}`}><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${lesson.completed ? 'bg-[hsl(var(--primary)/.13)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}>{lesson.completed ? <Check size={15} /> : <span className="font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>}</div><div className="flex-1"><div className="text-sm font-bold">{lesson.title}</div><div className="mt-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{lesson.durationMinutes} MIN</div></div><button className="btn btn-outline px-3 py-2" data-testid={`button-lesson-${lesson.id}`}>{lesson.completed ? 'Review' : 'Start'} <ArrowRight size={13} /></button></div>)}</div></div><aside className="panel h-fit p-6"><div className="eyebrow">Sequence notes</div><div className="mt-6 space-y-5"><Info label="Lessons" value={String(module.lessonCount)} /><Info label="Completed" value={String(module.completedLessons)} /><Info label="Level" value={module.level} /></div><Link href="/labs" className="btn btn-primary mt-8 w-full" data-testid="link-module-labs">Apply in a lab <ArrowRight size={14} /></Link></aside></div></Page>; }

function Progress() { const { data, isLoading, isError, refetch } = useGetProgress(); if (isLoading) return <Page><PageHeader eyebrow="Your signal" title="Reading progress." /><LoadingRows /></Page>; if (isError || !data) return <Page><StatePanel kind="error" title="Progress unavailable" body="Your progress summary could not be retrieved." retry={refetch} /></Page>; return <Page><PageHeader eyebrow="Your signal" title="Progress you can see." body="A clear read on what is sticking, and where to focus next." /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Overall progress" value={`${data.overallProgress}%`} detail="Across your path" icon={Gauge} /><Stat label="Labs completed" value={data.labsCompleted} detail={`${data.labsStarted} started`} icon={CheckCircle2} /><Stat label="Commands learned" value={data.commandsLearned} detail="In your reference" icon={Command} /><Stat label="Current streak" value={`${data.currentStreak}d`} detail="Keep showing up" icon={Flame} accent="orange" /></div><section className="panel mt-8 p-6"><div className="eyebrow">Category breakdown</div><div className="mt-6 space-y-6">{data.categoryProgress?.map((cat, i) => <div key={cat.category} data-testid={`progress-category-${i}`}><div className="mb-2 flex justify-between text-xs font-bold"><span>{cat.category}</span><span className="font-mono text-[hsl(var(--primary))]">{cat.progress}% <span className="text-[hsl(var(--muted-foreground))]">/ {cat.completed} of {cat.total}</span></span></div><div className="progress-track"><div className="progress-bar" style={{ width: `${cat.progress}%` }} /></div></div>)}</div></section></Page>; }

function Achievements() { const { data, isLoading, isError, refetch } = useListAchievements(); return <Page><PageHeader eyebrow="Collection" title="Proof of practice." body="Milestones earned by doing the work, not by checking a box." /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{isLoading ? <LoadingRows count={6} /> : isError ? <StatePanel kind="error" title="Achievements unavailable" body="Your collection could not be loaded." retry={refetch} /> : data?.length ? data.map(item => <div className={`panel p-6 ${!item.unlocked ? 'opacity-65' : ''}`} key={item.id} data-testid={`achievement-${item.id}`}><div className="flex items-start justify-between"><div className={`grid h-12 w-12 place-items-center rounded-xl ${item.unlocked ? 'bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'}`}><Award size={22} /></div>{item.unlocked ? <span className="tag tag-orange">UNLOCKED</span> : <LockKeyhole size={15} className="text-[hsl(var(--muted-foreground))]" />}</div><h2 className="mt-6 font-extrabold">{item.name}</h2><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{item.description}</p>{!item.unlocked && <><div className="mt-5 flex justify-between font-mono text-[10px]"><span>{item.progress} / {item.target}</span><span>{Math.round((item.progress / item.target) * 100)}%</span></div><div className="progress-track mt-2"><div className="progress-bar" style={{ width: `${Math.min(100, item.progress / item.target * 100)}%`, background: 'hsl(var(--accent))' }} /></div></>}</div>) : <div className="col-span-full"><StatePanel title="No achievements yet" body="Keep practicing. Your first milestone is close." /></div>}</div></Page>; }

function Profile() { const { data: user, isLoading } = useGetCurrentUser(); return <Page><PageHeader eyebrow="Identity" title="Operator profile." body="Your training identity and account signal." /><div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">{isLoading ? <LoadingRows count={2} /> : <><section className="panel p-7"><Avatar user={user} /><h2 className="mt-5 text-xl font-extrabold" data-testid="text-profile-name">{user?.name || 'Student operator'}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{user?.email || 'student@cyberlab.local'}</p><span className="tag tag-teal mt-5">{user?.role || 'student'} account</span></section><section className="panel p-7"><div className="eyebrow">Account details</div><div className="mt-6 grid gap-5 sm:grid-cols-2"><Info label="Operator ID" value={user?.id || 'Pending'} /><Info label="Created" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'} /><Info label="Last active" value={user?.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Not available'} /><Info label="Access level" value={user?.role === 'admin' ? 'Administrator' : 'Student operator'} /></div><button className="btn btn-outline mt-8" data-testid="button-edit-profile">Edit profile <ArrowRight size={13} /></button></section></>}</div></Page>; }

function SettingsPage() { const [saved, setSaved] = useState(false); return <Page><PageHeader eyebrow="Preferences" title="Tune your console." body="Keep the workspace aligned with how you learn and operate." /><div className="max-w-3xl space-y-5"><section className="panel p-6"><div className="eyebrow">Notifications</div><Toggle label="Training reminders" body="A nudge when your practice streak is at risk." /><Toggle label="Achievement alerts" body="Know when a milestone is ready to claim." /></section><section className="panel p-6"><div className="eyebrow">Session defaults</div><label className="mt-5 block text-xs font-bold">Default difficulty<select className="input mt-2 sm:w-64" data-testid="select-default-difficulty"><option>Medium</option><option>Easy</option><option>Hard</option></select></label><label className="mt-5 block text-xs font-bold">Interface density<select className="input mt-2 sm:w-64" data-testid="select-interface-density"><option>Comfortable</option><option>Dense</option></select></label></section><button className="btn btn-primary" onClick={() => setSaved(true)} data-testid="button-save-settings">{saved ? 'Preferences saved' : 'Save preferences'} <Check size={14} /></button></div></Page>; }
function Toggle({ label, body }: { label: string; body: string }) { const [on, setOn] = useState(true); return <button className="mt-5 flex w-full items-center justify-between text-left" onClick={() => setOn(!on)} data-testid={`button-toggle-${label.toLowerCase().replaceAll(' ', '-')}`}><span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{body}</span></span><span className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--secondary))]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} /></span></button>; }

function AdminOverview() { const { data, isLoading, isError, refetch } = useGetAdminOverview(); if (isLoading) return <Page><PageHeader eyebrow="Control room" title="Loading operations." /><LoadingRows count={5} /></Page>; if (isError || !data) return <Page><StatePanel kind="error" title="Operations unavailable" body="The admin overview could not be loaded." retry={refetch} /></Page>; const stats = [['Total users', data.totalUsers, Users], ['Active users', data.activeUsers, Activity], ['Published labs', data.publishedLabs, Layers3], ['Running instances', data.runningInstances, Radio], ['Labs completed', data.labsCompleted, CheckCircle2], ['Flag submissions', data.flagSubmissions, LockKeyhole]] as const; return <Page><PageHeader eyebrow="Control room" title="Know what is moving." body="Platform health, participation, and the edges that need attention." action={<Link href="/admin/reports" className="btn btn-outline" data-testid="link-admin-reports">Export report <Download size={14} /></Link>} /><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{stats.map(([label, value, Icon]) => <Stat key={label} label={label} value={value} detail="Current platform signal" icon={Icon} />)}</div><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]"><section className="panel p-6"><div className="flex justify-between"><div className="eyebrow">Recent platform activity</div><span className={`tag ${data.dockerConnected ? 'tag-teal' : 'tag-orange'}`}>{data.dockerConnected ? 'DOCKER CONNECTED' : 'DOCKER OFFLINE'}</span></div><div className="mt-5 divide-y divide-[hsl(var(--border))]">{data.recentActivity?.length ? data.recentActivity.map(item => <div className="flex gap-4 py-4" key={item.id} data-testid={`admin-activity-${item.id}`}><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--accent))]" /><div><div className="text-sm font-bold">{item.title}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.detail}</div></div><span className="ml-auto whitespace-nowrap font-mono text-[9px] text-[hsl(var(--muted-foreground))]">{item.timestamp}</span></div>) : <p className="py-6 text-sm text-[hsl(var(--muted-foreground))]">No recent platform activity.</p>}</div></section><section className="panel p-6"><div className="eyebrow">Platform readiness</div><div className="mt-7"><div className="flex items-center justify-between"><span className="text-sm font-bold">Docker integration</span><span className={`h-2.5 w-2.5 rounded-full ${data.dockerConnected ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--accent))]'}`} /></div><p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{data.dockerConnected ? 'Targets are available for instance provisioning.' : 'No connected Docker target. Lab terminals remain pending.'}</p></div><Link href="/admin/lab-instances" className="btn btn-quiet mt-7 w-full" data-testid="link-monitor-instances">Monitor instances <ArrowRight size={13} /></Link></section></div></Page>; }

function AdminUsers() { const [search, setSearch] = useState(''); const { data, isLoading, isError, refetch } = useListUsers({ search: search || undefined }); return <AdminListPage eyebrow="Administration / users" title="User directory" action="Invite user"><div className="panel mb-5 p-3"><div className="relative"><Search className="absolute left-3 top-3 text-[hsl(var(--muted-foreground))]" size={15} /><input className="input pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..." data-testid="input-search-users" /></div></div>{isLoading ? <LoadingRows /> : isError ? <StatePanel kind="error" title="User directory unavailable" body="Try again in a moment." retry={refetch} /> : data?.length ? <div className="panel overflow-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-[hsl(var(--border))] text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><th className="p-4">Operator</th><th>Role</th><th>Created</th><th>Last active</th><th className="p-4"></th></tr></thead><tbody>{data.map(user => <tr className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/.5)]" key={user.id} data-testid={`row-user-${user.id}`}><td className="p-4"><div className="flex items-center gap-3"><Avatar user={user} size="sm" /><div><div className="font-bold">{user.name}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{user.email}</div></div></div></td><td><span className="tag">{user.role}</span></td><td className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(user.createdAt).toLocaleDateString()}</td><td className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : '—'}</td><td className="p-4 text-right"><button className="rounded p-2 hover:bg-[hsl(var(--secondary))]" data-testid={`button-user-menu-${user.id}`}><MoreHorizontal size={15} /></button></td></tr>)}</tbody></table></div> : <StatePanel title="No users found" body="No operator records match this search." />}</AdminListPage>; }

function AdminListPage({ eyebrow, title, action, onAction, children }: { eyebrow: string; title: string; action?: string; onAction?: () => void; children: ReactNode }) { return <Page><PageHeader eyebrow={eyebrow} title={title} action={action ? <button className="btn btn-primary" onClick={onAction} data-testid={`button-add-${title.toLowerCase().replaceAll(' ', '-')}`}><Plus size={14} /> {action}</button> : undefined} />{children}</Page>; }

function AdminLabs() { const { data, isLoading, isError, refetch } = useListLabs(); const create = useCreateLab(); const update = useUpdateLab(); const remove = useDeleteLab(); const [showForm, setShowForm] = useState(false); const [name, setName] = useState(''); const submit = () => { if (!name.trim()) return; create.mutate({ data: { name, description: 'New training scenario', categoryId: 'cat-recon', difficulty: 'Medium', estimatedMinutes: 30, instructions: 'Add instructions.' } }, { onSuccess: () => { setName(''); setShowForm(false); queryClient.invalidateQueries(); } }); }; return <AdminListPage eyebrow="Administration / labs" title="Lab management" action="Create lab" onAction={() => setShowForm(true)}>{showForm && <div className="panel mb-5 flex gap-3 p-4"><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Lab name" data-testid="input-new-lab-name" /><button className="btn btn-primary" onClick={submit} disabled={create.isPending} data-testid="button-save-new-lab">Create</button><button className="btn btn-quiet" onClick={() => setShowForm(false)} data-testid="button-cancel-new-lab"><X size={14} /></button></div>}<div className="mb-5 rounded-lg border border-[hsl(var(--accent)/.3)] bg-[hsl(var(--accent)/.07)] p-4 text-xs text-[hsl(var(--accent))]">Lab editing is live against the API. Docker targets must be configured before a terminal can be provisioned.</div>{isLoading ? <LoadingRows /> : isError ? <StatePanel kind="error" title="Labs unavailable" body="Could not load management data." retry={refetch} /> : data?.length ? <div className="panel divide-y divide-[hsl(var(--border))]">{data.map(lab => <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center" key={lab.id} data-testid={`admin-lab-${lab.id}`}><div className="flex-1"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: lab.accent || '#2eb79f' }} /><h3 className="text-sm font-extrabold">{lab.name}</h3><span className="tag">{lab.status}</span></div><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{lab.category.name} / {lab.difficulty} / {lab.estimatedMinutes} min</p></div><div className="flex gap-2"><button className="btn btn-outline" onClick={() => update.mutate({ id: lab.id, data: { name: lab.name, description: lab.description, categoryId: lab.category.id, difficulty: lab.difficulty, estimatedMinutes: lab.estimatedMinutes, instructions: 'Updated from admin console.' } })} data-testid={`button-edit-lab-${lab.id}`}>Edit</button><button className="btn btn-outline text-[hsl(var(--destructive))]" onClick={() => { if (window.confirm('Delete this lab?')) remove.mutate({ id: lab.id }, { onSuccess: () => queryClient.invalidateQueries() }); }} data-testid={`button-delete-lab-${lab.id}`}><Trash2 size={14} /></button></div></div>)}</div> : <StatePanel title="No labs yet" body="Create your first training scenario." />}</AdminListPage>; }

function AdminSimple({ type }: { type: 'commands' | 'categories' | 'learning' | 'reports' | 'settings' }) { const config: { title: string; body: string; Icon: typeof Command } = { commands: { title: 'Command management', body: 'Maintain the operator reference library.', Icon: Command }, categories: { title: 'Category management', body: 'Shape the taxonomy that keeps practice findable.', Icon: Database }, learning: { title: 'Learning management', body: 'Publish lessons that prepare the next lab.', Icon: BookOpen }, reports: { title: 'Reports', body: 'Read participation and platform outcomes.', Icon: FileText }, settings: { title: 'Platform settings', body: 'Configure the guardrails for your training environment.', Icon: Settings } }[type]; const Icon = config.Icon; const { data: commands } = useListCommands(); const { data: modules } = useListLearningModules(); const [notice, setNotice] = useState(''); const action = () => setNotice(type === 'reports' ? 'Report prepared for download.' : 'Use the API-backed management view to add records.'); return <Page><PageHeader eyebrow={`Administration / ${type}`} title={config.title} body={config.body} action={type !== 'reports' && type !== 'settings' ? <button className="btn btn-primary" onClick={action} data-testid={`button-add-${type}`}><Plus size={14} /> Add {type === 'learning' ? 'module' : type.slice(0, -1)}</button> : type === 'reports' ? <button className="btn btn-outline" onClick={action} data-testid="button-download-report"><Download size={14} /> Download CSV</button> : undefined} /><div className="grid gap-5 md:grid-cols-[1fr_300px]"><section className="panel p-6"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]"><Icon size={18} /></div><div><div className="eyebrow">Workspace surface</div><h2 className="mt-1 font-extrabold">{type === 'commands' ? `${commands?.length || 0} command entries` : type === 'learning' ? `${modules?.length || 0} learning modules` : 'Configuration ready'}</h2></div></div><div className="mt-8 rounded-lg border border-dashed border-[hsl(var(--border))] p-8 text-center"><SlidersHorizontal className="mx-auto text-[hsl(var(--muted-foreground))]" size={22} /><p className="mt-3 text-sm font-bold">Management surface ready</p><p className="mt-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{notice || (type === 'settings' ? 'Platform-level configuration changes will appear here.' : 'Use the action above to add a record, or select an existing entry to edit it.')}</p></div></section><aside className="panel p-6"><div className="eyebrow">Operator note</div><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Keep taxonomy tight and descriptions operational. Students should know what to do next without leaving the console.</p></aside></div></Page>; }

function AdminInstances() { const { data, isLoading, isError, refetch } = useListLabInstances(); return <AdminListPage eyebrow="Administration / instances" title="Lab instance monitoring"><div className="mb-5 grid gap-3 sm:grid-cols-3"><Stat label="Running" value={data?.filter(x => x.status === 'running').length || 0} detail="Active targets" icon={Radio} /><Stat label="Pending" value={data?.filter(x => x.status === 'pending').length || 0} detail="Awaiting Docker" icon={Server} accent="orange" /><Stat label="Completed" value={data?.filter(x => x.status === 'completed').length || 0} detail="Closed sessions" icon={CheckCircle2} /></div>{isLoading ? <LoadingRows /> : isError ? <StatePanel kind="error" title="Instances unavailable" body="Monitoring data could not be loaded." retry={refetch} /> : data?.length ? <div className="panel divide-y divide-[hsl(var(--border))]">{data.map(instance => <div className="flex flex-wrap items-center gap-4 p-5" key={instance.id} data-testid={`instance-${instance.id}`}><div className="grid h-9 w-9 place-items-center rounded-md bg-[hsl(var(--secondary))]"><Server size={15} /></div><div className="min-w-[180px] flex-1"><div className="text-sm font-bold">{instance.labName}</div><div className="mt-1 font-mono text-[10px] text-[hsl(var(--muted-foreground))]">user {instance.userId} / {instance.durationMinutes} min</div></div><span className={`tag ${instance.status === 'running' ? 'tag-teal' : instance.status === 'pending' ? 'tag-orange' : ''}`}>{instance.status}</span><span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">{instance.dockerConfigured ? 'DOCKER READY' : 'DOCKER NOT CONFIGURED'}</span></div>)}</div> : <StatePanel title="No lab instances" body="Active and completed sessions will appear here." />}</AdminListPage>; }

function Router() { const [location] = useLocation(); const publicRoute = ['/', '/login', '/register', '/sign-in', '/sign-up'].includes(location) || location.startsWith('/sign-in/') || location.startsWith('/sign-up/'); return <ErrorBoundary resetKey={location}>{publicRoute ? <Switch><Route path="/" component={HomeRoute} /><Route path="/login"><Redirect to="/sign-in" /></Route><Route path="/register"><Redirect to="/sign-up" /></Route><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route component={NotFound} /></Switch> : <Shell><Switch><Route path="/dashboard" component={Dashboard} /><Route path="/labs" component={Labs} /><Route path="/labs/:id/workspace" component={Workspace} /><Route path="/labs/:id" component={LabDetailPage} /><Route path="/commands" component={Commands} /><Route path="/commands/:id" component={CommandDetail} /><Route path="/learning" component={Learning} /><Route path="/learning/:id" component={LearningDetail} /><Route path="/progress" component={Progress} /><Route path="/achievements" component={Achievements} /><Route path="/profile" component={Profile} /><Route path="/settings" component={SettingsPage} /><Route path="/admin" component={AdminOverview} /><Route path="/admin/users" component={AdminUsers} /><Route path="/admin/labs" component={AdminLabs} /><Route path="/admin/commands"><AdminSimple type="commands" /></Route><Route path="/admin/categories"><AdminSimple type="categories" /></Route><Route path="/admin/learning"><AdminSimple type="learning" /></Route><Route path="/admin/lab-instances" component={AdminInstances} /><Route path="/admin/reports"><AdminSimple type="reports" /></Route><Route path="/admin/settings"><AdminSimple type="settings" /></Route><Route component={NotFound} /></Switch></Shell>}</ErrorBoundary>; }

function ApiClientAuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL?.trim();
    setBaseUrl(apiUrl || null);
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to => setLocation(to.replace(basePath, '') || '/')} routerReplace={to => setLocation(to.replace(basePath, '') || '/')} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start your training sequence' } } }}><ClerkCacheInvalidator /><Router /></ClerkProvider>;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={to => setLocation(to.replace(basePath, '') || '/')} routerReplace={to => setLocation(to.replace(basePath, '') || '/')} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your account' } }, signUp: { start: { title: 'Create your account', subtitle: 'Start your training sequence' } } }}><ApiClientAuthBridge /><ClerkCacheInvalidator /><Router /></ClerkProvider>;
}

function App() { return <WouterRouter base={basePath}><QueryClientProvider client={queryClient}><ClerkApp /></QueryClientProvider></WouterRouter>; }
export default App;