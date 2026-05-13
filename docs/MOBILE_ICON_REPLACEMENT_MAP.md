# Mobile Icon Replacement Map (RifahMobile)

Use this as the canonical naming map for your new SVG icon pack.

## 1) Brand / Auth

1. `logo_refah_primary.svg`
- Replace: `assets/refahlogo.png`
- Used in: `RifahMobile/src/screens/LoginScreen.tsx`, `RifahMobile/src/screens/RegisterScreen.tsx`

2. `logo_refah_splash.svg`
- Replace: `assets/logo.png`
- Used in: `RifahMobile/src/screens/SplashScreen.tsx`, `RifahMobile/src/screens/WelcomeScreen.tsx`

3. `icon_google_brand.svg`
- Replace: temporary text `G`
- Used in: `RifahMobile/src/screens/LoginScreen.tsx`, `RifahMobile/src/screens/RegisterScreen.tsx`

4. `icon_apple_brand.svg`
- Replace: temporary text ``
- Used in: `RifahMobile/src/screens/LoginScreen.tsx`

5. `icon_eye_open.svg`
- Replace: `👁️`
- Used in: `RifahMobile/src/screens/LoginScreen.tsx`, `RifahMobile/src/screens/RegisterScreen.tsx`

6. `icon_eye_closed.svg`
- Replace: `👁️‍🗨️`
- Used in: `RifahMobile/src/screens/LoginScreen.tsx`, `RifahMobile/src/screens/RegisterScreen.tsx`

## 2) Tabs / Drawer / Core Nav

1. `icon_tab_home.svg` (🏠)
- Used in: `RifahMobile/src/navigation/TabNavigator.tsx`

2. `icon_tab_bookings.svg` (📅)
- Used in: `RifahMobile/src/navigation/TabNavigator.tsx`

3. `icon_tab_purchases.svg` (🛍️)
- Used in: `RifahMobile/src/navigation/TabNavigator.tsx`

4. `icon_tab_profile.svg` (👤)
- Used in: `RifahMobile/src/navigation/TabNavigator.tsx`

5. `icon_drawer_dashboard.svg` (📊)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

6. `icon_drawer_profile.svg` (👤)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

7. `icon_drawer_bookings.svg` (📅)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

8. `icon_drawer_purchases.svg` (🛍️)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

9. `icon_drawer_payments.svg` (💳)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

10. `icon_drawer_wallet.svg` (🔥)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

11. `icon_drawer_settings.svg` (⚙️)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

12. `icon_drawer_browse.svg` (🏢)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`

13. `icon_logout.svg` (🚪)
- Used in: `RifahMobile/src/navigation/DrawerNavigator.tsx`, `RifahMobile/src/screens/MoreScreen.tsx`

14. `icon_login_lock.svg` (🔐)
- Used in: `RifahMobile/src/screens/MoreScreen.tsx`

## 3) Common Utility / Actions

1. `icon_search.svg` (🔍 / Ionicons search equivalents)
2. `icon_bell.svg` (🔔 / notifications-outline)
3. `icon_calendar.svg` (📅 / calendar-outline)
4. `icon_cart.svg` (🛍️ / cart-outline)
5. `icon_user.svg` (👤 / people / people-outline)
6. `icon_card.svg` (💳 / card-outline)
7. `icon_cash.svg` (cash-outline)
8. `icon_wallet.svg` (🔥)
9. `icon_settings.svg` (⚙️)
10. `icon_location.svg` (📍 / map)
11. `icon_phone.svg` (call-outline)
12. `icon_mail.svg` (mail-outline)
13. `icon_globe.svg` (🌐 / globe-outline)
14. `icon_share.svg` (share-outline)
15. `icon_plus.svg` (add)
16. `icon_minus.svg` (remove)
17. `icon_delete.svg` (trash-outline)
18. `icon_close.svg` (close)
19. `icon_check.svg` (checkmark)
20. `icon_check_circle.svg` (checkmark-circle)
21. `icon_star.svg` (star)
22. `icon_clock.svg` (time-outline)
23. `icon_arrow_back.svg` (arrow-back)
24. `icon_arrow_forward.svg` (arrow-forward)
25. `icon_warning.svg` (⚠️ / alert-circle-outline)
26. `icon_image_placeholder.svg` (image-outline)
27. `icon_notifications_off.svg` (notifications-off-outline)
28. `icon_rocket.svg` (rocket-outline)
29. `icon_bicycle.svg` (bicycle-outline)
30. `icon_lock.svg` (lock-closed)
31. `icon_file.svg` (📄)
32. `icon_message.svg` (💬)
33. `icon_sparkles.svg` (✨)
34. `icon_folder.svg` (📂)

## 4) Social Icons

1. `icon_social_instagram.svg`
2. `icon_social_twitter.svg`
3. `icon_social_facebook.svg`
4. `icon_social_linkedin.svg`
5. `icon_social_youtube.svg`
6. `icon_social_tiktok.svg`
7. `icon_social_snapchat.svg`
8. `icon_social_website.svg`
9. `icon_social_link.svg`

Used in:
- `RifahMobile/src/screens/TenantScreen.tsx` (Ionicons social logos)
- `RifahMobile/src/screens/MoreScreen.tsx` (emoji social mapping)

## 5) Optional Decorative / Legacy Emoji Targets

1. `icon_hot_deals.svg` (🔥 prefix in section title)
2. `icon_brand_heart.svg` (💜 in drawer brand)
3. `icon_edit.svg` (✏️ in drawer stats/actions)

---

## Suggested Delivery Format From Design Team

1. Export all SVGs to: `RifahMobile/assets/icons/`
2. Keep exact filenames above.
3. Prefer:
- `24x24` for regular icons
- `20x20` for compact rows
- `16x16` for metadata/icon chips
4. For brand logos:
- include one full-color and one monochrome variant if possible:
  - `logo_refah_primary.svg`
  - `logo_refah_primary_mono.svg`

