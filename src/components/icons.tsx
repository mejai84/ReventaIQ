import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function BaseIcon({ children, size = 20, ...props }: IconProps) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
}

export function ArrowRight(props: IconProps) { return <BaseIcon {...props}><path d="M5 12h14M13 6l6 6-6 6" /></BaseIcon>; }
export function ArrowUpRight(props: IconProps) { return <BaseIcon {...props}><path d="M7 17 17 7M8 7h9v9" /></BaseIcon>; }
export function BarChart3(props: IconProps) { return <BaseIcon {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></BaseIcon>; }
export function Box(props: IconProps) { return <BaseIcon {...props}><path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10" /></BaseIcon>; }
export function Check(props: IconProps) { return <BaseIcon {...props}><path d="m5 12 4 4L19 6" /></BaseIcon>; }
export function ChevronRight(props: IconProps) { return <BaseIcon {...props}><path d="m9 18 6-6-6-6" /></BaseIcon>; }
export function CircleDollarSign(props: IconProps) { return <BaseIcon {...props}><circle cx="12" cy="12" r="9" /><path d="M15 9.5c0-1-1.3-1.7-3-1.7s-3 .7-3 1.8c0 2.7 6 1.2 6 4 0 1.1-1.3 1.8-3 1.8s-3-.7-3-1.7M12 6v12" /></BaseIcon>; }
export function FileSearch(props: IconProps) { return <BaseIcon {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M11 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2.2-1.8L16 18" /></BaseIcon>; }
export function LockKeyhole(props: IconProps) { return <BaseIcon {...props}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></BaseIcon>; }
export function Menu(props: IconProps) { return <BaseIcon {...props}><path d="M4 7h16M4 12h16M4 17h16" /></BaseIcon>; }
export function Plus(props: IconProps) { return <BaseIcon {...props}><path d="M12 5v14M5 12h14" /></BaseIcon>; }
export function ShieldCheck(props: IconProps) { return <BaseIcon {...props}><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Zm-3 9 2 2 4-4" /></BaseIcon>; }
export function ShoppingBag(props: IconProps) { return <BaseIcon {...props}><path d="M5 8h14l-1 13H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2" /></BaseIcon>; }
export function Sparkles(props: IconProps) { return <BaseIcon {...props}><path d="m12 3-1.3 5.7L5 10l5.7 1.3L12 17l1.3-5.7L19 10l-5.7-1.3L12 3ZM5 16l-.6 2.4L2 19l2.4.6L5 22l.6-2.4L8 19l-2.4-.6L5 16Z" /></BaseIcon>; }
export function TrendingUp(props: IconProps) { return <BaseIcon {...props}><path d="m4 16 6-6 4 4 6-7M15 7h5v5" /></BaseIcon>; }
export function X(props: IconProps) { return <BaseIcon {...props}><path d="m6 6 12 12M18 6 6 18" /></BaseIcon>; }
