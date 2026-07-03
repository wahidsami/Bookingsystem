import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Sparkles,
  Package,
  CreditCard,
  TrendingUp,
  BarChart3,
  Megaphone,
  Gift,
  Award,
  Star,
  Boxes,
  ShieldAlert,
  Receipt,
  Settings,
  Search,
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Languages,
  LogOut,
  Building,
  Check,
  ExternalLink,
  ChevronDown,
  Clock,
  ArrowUpRight,
  Phone,
  Shield,
  Sliders,
  Globe,
  Info,
  CalendarCheck2,
  AlertTriangle,
  Tag,
  Percent,
  MessageSquare
} from 'lucide-react';

const icons: Record<string, any> = {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Sparkles,
  Package,
  CreditCard,
  TrendingUp,
  BarChart3,
  Megaphone,
  Gift,
  Award,
  Star,
  Boxes,
  ShieldAlert,
  Receipt,
  Settings,
  Search,
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Languages,
  LogOut,
  Building,
  Check,
  ExternalLink,
  ChevronDown,
  Clock,
  ArrowUpRight,
  Phone,
  Shield,
  Sliders,
  Globe,
  Info,
  CalendarCheck2,
  AlertTriangle,
  Tag,
  Percent,
  MessageSquare
};

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function LucideIcon({ name, className = '', size = 18 }: LucideIconProps) {
  const IconComponent = icons[name] || HelpCircleIcon;
  return <IconComponent className={className} size={size} />;
}

function HelpCircleIcon({ className = '', size = 18 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
