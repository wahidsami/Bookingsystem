import React from 'react';

import BellIcon from '../../assets/icons/icon_bell.svg';
import SearchIcon from '../../assets/icons/icon_search.svg';
import CalendarIcon from '../../assets/icons/icon_calendar.svg';
import CartIcon from '../../assets/icons/icon_cart.svg';
import UserIcon from '../../assets/icons/icon_user.svg';
import SettingsIcon from '../../assets/icons/icon_settings.svg';
import LocationIcon from '../../assets/icons/icon_location.svg';
import MessageIcon from '../../assets/icons/icon_message.svg';
import SparklesIcon from '../../assets/icons/icon_sparkles.svg';
import FileIcon from '../../assets/icons/icon_file.svg';
import FolderIcon from '../../assets/icons/icon_folder.svg';
import LogoutIcon from '../../assets/icons/icon_logout.svg';
import LockIcon from '../../assets/icons/icon_login_lock.svg';
import HomeIcon from '../../assets/icons/icon_tab_home.svg';
import PurchasesIcon from '../../assets/icons/icon_tab_purchases.svg';
import BookingsIcon from '../../assets/icons/icon_tab_bookings.svg';
import ProfileIcon from '../../assets/icons/icon_tab_profile.svg';
import DashboardIcon from '../../assets/icons/icon_drawer_dashboard.svg';
import BrowseIcon from '../../assets/icons/icon_drawer_browse.svg';
import GlobeIcon from '../../assets/icons/icon_globe.svg';
import LinkIcon from '../../assets/icons/icon_social_link.svg';
import ShareIcon from '../../assets/icons/icon_share.svg';
import PlusIcon from '../../assets/icons/icon_plus.svg';
import MinusIcon from '../../assets/icons/icon_minus.svg';
import DeleteIcon from '../../assets/icons/icon_delete.svg';
import BicycleIcon from '../../assets/icons/icon_bicycle.svg';
import RocketIcon from '../../assets/icons/icon_rocket.svg';
import CardIcon from '../../assets/icons/icon_card.svg';
import CashIcon from '../../assets/icons/icon_cash.svg';
import ClockIcon from '../../assets/icons/icon_clock.svg';
import WarningIcon from '../../assets/icons/icon_warning.svg';
import ImagePlaceholderIcon from '../../assets/icons/icon_image_placeholder.svg';
import NotificationsOffIcon from '../../assets/icons/icon_notifications_off.svg';
import PhoneIcon from '../../assets/icons/icon_phone.svg';
import MailIcon from '../../assets/icons/icon_mail.svg';
import ArrowBackIcon from '../../assets/icons/icon_arrow_back.svg';
import ArrowForwardIcon from '../../assets/icons/icon_arrow_forward.svg';
import CloseIcon from '../../assets/icons/icon_close.svg';
import StarIcon from '../../assets/icons/icon_star.svg';
import InstagramIcon from '../../assets/icons/icon_social_instagram.svg';
import TiktokIcon from '../../assets/icons/icon_social_tiktok.svg';
import YoutubeIcon from '../../assets/icons/icon_social_youtube.svg';
import TwitterIcon from '../../assets/icons/icon_social_twitter.svg';
import LinkedinIcon from '../../assets/icons/icon_social_linkedin.svg';
import SnapchatIcon from '../../assets/icons/icon_social_snapchat.svg';
import WebsiteIcon from '../../assets/icons/icon_social_website.svg';

type IconName =
  | 'home'
  | 'bookings'
  | 'dashboard'
  | 'browse'
  | 'purchases'
  | 'profile'
  | 'bell'
  | 'search'
  | 'cart'
  | 'user'
  | 'settings'
  | 'location'
  | 'message'
  | 'sparkles'
  | 'file'
  | 'folder'
  | 'logout'
  | 'lock'
  | 'globe'
  | 'share'
  | 'plus'
  | 'minus'
  | 'delete'
  | 'bicycle'
  | 'rocket'
  | 'card'
  | 'cash'
  | 'clock'
  | 'warning'
  | 'image'
  | 'notifications_off'
  | 'phone'
  | 'mail'
  | 'arrow_back'
  | 'arrow_forward'
  | 'close'
  | 'star'
  | 'link'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'linkedin'
  | 'snapchat'
  | 'website';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

const iconMap = {
  home: HomeIcon,
  bookings: BookingsIcon,
  dashboard: DashboardIcon,
  browse: BrowseIcon,
  purchases: PurchasesIcon,
  profile: ProfileIcon,
  bell: BellIcon,
  search: SearchIcon,
  cart: CartIcon,
  user: UserIcon,
  settings: SettingsIcon,
  location: LocationIcon,
  message: MessageIcon,
  sparkles: SparklesIcon,
  file: FileIcon,
  folder: FolderIcon,
  logout: LogoutIcon,
  lock: LockIcon,
  globe: GlobeIcon,
  share: ShareIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  delete: DeleteIcon,
  bicycle: BicycleIcon,
  rocket: RocketIcon,
  card: CardIcon,
  cash: CashIcon,
  clock: ClockIcon,
  warning: WarningIcon,
  image: ImagePlaceholderIcon,
  notifications_off: NotificationsOffIcon,
  phone: PhoneIcon,
  mail: MailIcon,
  arrow_back: ArrowBackIcon,
  arrow_forward: ArrowForwardIcon,
  close: CloseIcon,
  star: StarIcon,
  link: LinkIcon,
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  youtube: YoutubeIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
  snapchat: SnapchatIcon,
  website: WebsiteIcon,
} as const;

export function AppIcon({ name, size = 22, color = '#7F50D2' }: Props) {
  const Icon = iconMap[name] || WarningIcon;
  return <Icon width={size} height={size} color={color} />;
}
