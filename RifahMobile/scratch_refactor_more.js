const fs = require('fs');
const path = require('path');

const srcDir = 'd:/Waheed/Refah/Bookingsystem/RifahMobile/src/screens';

function updateFile(fileName, transform) {
    const filePath = path.join(srcDir, fileName);
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = transform(content);
    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${fileName}`);
    } else {
        console.log(`No changes for ${fileName}`);
    }
}

updateFile('MoreScreen.tsx', (content) => {
    // We want to replace the whole return block and add PageHeader import
    let newContent = content;
    
    // Replace AccountHeader import with PageHeader
    newContent = newContent.replace(
        /import \{ AccountHeader \} from '\.\.\/components\/ui\/AccountHeader';/,
        `import { PageHeader } from '../components/ui/PageHeader';`
    );

    // Replace styles to have the new stitch-like structure
    // but wait, we need to completely replace the return statement and styles.
    // Let's use a regex to capture the return block.
    const returnRegex = /return \([\s\S]*?\);\n\}/;
    
    const newReturn = `return (
        <View style={styles.container}>
            <PageHeader title={language === 'ar' ? 'حسابي' : 'Me'} showBack={false} />
            
            <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
            >
                {/* Profile Identity Area */}
                <View style={styles.profileHeader}>
                    <TouchableOpacity onPress={() => isAuthenticated ? navigation?.navigate('Profile') : showLogin()} style={styles.avatarWrap}>
                        <UserAvatar
                            firstName={user?.firstName}
                            lastName={user?.lastName}
                            profileImage={user?.profileImage}
                            size={80}
                        />
                    </TouchableOpacity>
                    <Text style={styles.profileName}>
                        {isAuthenticated ? (user ? \`\${user.firstName} \${user.lastName}\` : t('guestTitle')) : t('guestTitle')}
                    </Text>
                    {isAuthenticated && user?.email && (
                        <Text style={styles.profileEmail}>{user.email}</Text>
                    )}
                </View>

                {/* Wallet Preview Card (if authenticated) */}
                {isAuthenticated && (
                    <TouchableOpacity style={styles.walletCard} onPress={() => navigation?.navigate('Gifts')}>
                        <View style={styles.walletCardLeft}>
                            <View style={styles.walletIconWrap}>
                                <AppIcon name="account_balance_wallet" size={24} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={styles.walletCardTitle}>{language === 'ar' ? 'المحفظة' : 'Wallet'}</Text>
                                <Text style={styles.walletCardSub}>{language === 'ar' ? 'رصيد المركز الخاص بك' : 'Your center balance'}</Text>
                            </View>
                        </View>
                        <AppIcon name={language === 'ar' ? 'arrow_back' : 'chevron_right'} size={24} color={colors.textTertiary} />
                    </TouchableOpacity>
                )}

                {/* Menus */}
                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('myAppointments')}</Text>
                </View>
                <View style={styles.menuSection}>
                    {menuItems.filter(i => i.id !== 'gifts' && i.id !== 'profile').map((item) => (
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => {
                            if (item.id !== 'browse' && !isAuthenticated) { showLogin(); return; }
                            if (item.action) item.action();
                        }}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'chevron_right'} size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('settings')}</Text>
                </View>
                <View style={styles.menuSection}>
                    {settingsItems.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => {
                            if (!isAuthenticated) { showLogin(); return; }
                            item.action();
                        }}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'chevron_right'} size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeaderText}>{t('supportAndLegal')}</Text>
                </View>
                <View style={styles.menuSection}>
                    {supportItems.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.menuItem} onPress={item.action}>
                            <View style={styles.menuItemLeft}>
                                <View style={styles.menuIconWrap}>
                                    <AppIcon name={item.icon as any} size={20} color={colors.primary} />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                            </View>
                            <AppIcon name={language === 'ar' ? 'arrow_back' : 'chevron_right'} size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout Button */}
                <TouchableOpacity style={styles.logoutButton} onPress={handleAuthAction}>
                    <AppIcon name={isAuthenticated ? 'logout' : 'lock'} size={20} color={colors.error} />
                    <Text style={styles.logoutText}>{isAuthenticated ? t('logout') : t('loginNow')}</Text>
                </TouchableOpacity>

                {/* App Info */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoText}>Refah v1.0.0</Text>
                    <Text style={styles.appInfoText}>© 2024 Refah Platform</Text>
                </View>
            </ScrollView>
        </View>
    );
}`;
    
    newContent = newContent.replace(returnRegex, newReturn);
    
    // Now replace styles
    const stylesRegex = /const styles = StyleSheet\.create\(\{[\s\S]*\}\);/;
    const newStyles = `const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1 },
    profileHeader: { alignItems: 'center', paddingVertical: spacing.xl },
    avatarWrap: {
        marginBottom: spacing.md,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 4,
        borderRadius: 40,
    },
    profileName: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    profileEmail: { fontSize: 14, color: colors.textSecondary },
    walletCard: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        padding: spacing.lg,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        shadowColor: colors.brandPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    walletCardLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    walletIconWrap: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: colors.brandPrimaryLight,
        alignItems: 'center', justifyContent: 'center'
    },
    walletCardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    walletCardSub: { fontSize: 12, color: colors.textSecondary },
    sectionHeaderWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xs },
    sectionHeaderText: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    menuSection: {
        backgroundColor: colors.surface,
        marginHorizontal: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
        borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
    },
    menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    menuIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: colors.background,
        alignItems: 'center', justifyContent: 'center'
    },
    menuLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
    logoutButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
        marginHorizontal: spacing.lg, marginTop: spacing.xxl, padding: spacing.lg,
        borderRadius: 16, backgroundColor: colors.error + '11',
    },
    logoutText: { fontSize: 16, fontWeight: '700', color: colors.error },
    appInfo: { alignItems: 'center', padding: spacing.xl, gap: 4 },
    appInfoText: { fontSize: 12, color: colors.textTertiary },
});`;
    
    newContent = newContent.replace(stylesRegex, newStyles);
    return newContent;
});

