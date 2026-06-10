import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Modal, TextInput, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useMatches } from '../store/MatchContext';
import { useLocale, LANGUAGE_OPTIONS } from '../i18n/LocaleContext';
import { useAuth } from '../store/AuthContext';
import { supabase } from '../services/supabase';

const QUALITIES = ['4K 30fps', '1080p 60fps', '1080p 30fps', '720p 60fps'];

const AVATAR_COLORS = [
  '#00B96B', '#16A34A', '#E63946', '#DC2626',
  '#374151', '#6B7280', '#0D1117', '#4B5563',
];

const PRIVACY_TEXT = `PadelVision collects only the video footage and match data you explicitly upload. Your data is stored securely on Supabase and never shared with third parties without your consent.\n\nVideo frames are sent to an AI model for analysis and are not stored beyond the analysis request.\n\nYou can delete your account and all associated data at any time from this settings page.\n\nFor questions, contact: privacy@padelvision.app`;

const TERMS_TEXT = `By using PadelVision you agree to use the app for personal sports improvement only. Do not record other players without their consent.\n\nPadelVision uses AI-powered video analysis to help improve your padel game. Analytics are based on video frame analysis and statistical modelling — results are estimates intended for personal coaching guidance.\n\nVersion 1.0.0`;

export default function SettingsScreen({ navigation }: any) {
  const { colors, theme, toggleTheme } = useTheme();
  const { matches } = useMatches();
  const { t, locale, setLocale } = useLocale();
  const { signOut, isPro } = useAuth();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isDark = theme === 'dark';
  const [languageModal, setLanguageModal] = React.useState(false);

  const { userId } = useAuth();
  const profilePrefix = `@padelvision/profile_${userId}`;

  const [profileName, setProfileName] = React.useState('');
  const [userEmail, setUserEmail] = React.useState('');
  const [profileImage, setProfileImage] = React.useState<string | null>(null);
  const [tempImage, setTempImage] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [avatarColor, setAvatarColor] = React.useState('#00B96B');
  const [tempColor, setTempColor] = React.useState('#00B96B');
  const [profileModal, setProfileModal] = React.useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setTempImage(result.assets[0].uri);
    }
  };
  const [qualityModal, setQualityModal] = React.useState(false);
  const [selectedQuality, setSelectedQuality] = React.useState('1080p 60fps');
  const [policyModal, setPolicyModal] = React.useState<'privacy' | 'terms' | null>(null);
  const [tutorialEnabled, setTutorialEnabled] = React.useState(false);

  const [passwordModal, setPasswordModal] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');
  const [passwordSuccess, setPasswordSuccess] = React.useState(false);

  const changePassword = async () => {
    if (newPassword.length < 6) { setPasswordError('Mindestens 6 Zeichen'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwörter stimmen nicht überein'); return; }
    setPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setPasswordError(error.message); return; }
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setPasswordModal(false); setPasswordSuccess(false); }, 1500);
    } catch { setPasswordError('Fehler beim Speichern'); }
  };

  const [autoHighlight, setAutoHighlight] = React.useState(true);
  const [errorNotifications, setErrorNotifications] = React.useState(true);
  const [liveTracking, setLiveTracking] = React.useState(false);
  const [audioRecording, setAudioRecording] = React.useState(true);
  const [matchReminders, setMatchReminders] = React.useState(true);
  const [weeklySummary, setWeeklySummary] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          '@padelvision/tutorial_seen',
          '@padelvision/tutorial_always_show',
          `${profilePrefix}_name`,
          `${profilePrefix}_color`,
          `${profilePrefix}_image`,
          '@padelvision/quality',
          '@padelvision/toggle_autoHighlight',
          '@padelvision/toggle_errorNotifications',
          '@padelvision/toggle_liveTracking',
          '@padelvision/toggle_audioRecording',
          '@padelvision/toggle_matchReminders',
          '@padelvision/toggle_weeklySummary',
          '@padelvision/user',
        ]);
        const m = Object.fromEntries(entries.map(([k, v]) => [k, v]));
        setTutorialEnabled(m['@padelvision/tutorial_seen'] !== 'true' || m['@padelvision/tutorial_always_show'] === 'true');

        // Profile name: use saved per-user name, or fall back to registered username
        const savedName = m[`${profilePrefix}_name`];
        const parsedUser = m['@padelvision/user']
          ? (JSON.parse(m['@padelvision/user']) as { username?: string; email?: string })
          : null;
        const fallbackName = parsedUser?.username ?? '';
        const displayName = savedName ?? fallbackName;
        setProfileName(displayName);
        setEditName(displayName);
        setUserEmail(parsedUser?.email ?? '');

        if (m[`${profilePrefix}_color`]) { setAvatarColor(m[`${profilePrefix}_color`]!); setTempColor(m[`${profilePrefix}_color`]!); }
        if (m[`${profilePrefix}_image`]) setProfileImage(m[`${profilePrefix}_image`]);
        if (m['@padelvision/quality'])   setSelectedQuality(m['@padelvision/quality']!);
        if (m['@padelvision/toggle_autoHighlight'] != null)        setAutoHighlight(m['@padelvision/toggle_autoHighlight'] !== 'false');
        if (m['@padelvision/toggle_errorNotifications'] != null)   setErrorNotifications(m['@padelvision/toggle_errorNotifications'] !== 'false');
        if (m['@padelvision/toggle_liveTracking'] != null)         setLiveTracking(m['@padelvision/toggle_liveTracking'] === 'true');
        if (m['@padelvision/toggle_audioRecording'] != null)       setAudioRecording(m['@padelvision/toggle_audioRecording'] !== 'false');
        if (m['@padelvision/toggle_matchReminders'] != null)       setMatchReminders(m['@padelvision/toggle_matchReminders'] !== 'false');
        if (m['@padelvision/toggle_weeklySummary'] != null)        setWeeklySummary(m['@padelvision/toggle_weeklySummary'] !== 'false');
      } catch {}
    };
    load();
  }, [profilePrefix]);

  const saveToggle = async (key: string, val: boolean) => {
    try { await AsyncStorage.setItem(key, val ? 'true' : 'false'); } catch {}
  };

  const changeQuality = async (q: string) => {
    setSelectedQuality(q);
    setQualityModal(false);
    try { await AsyncStorage.setItem('@padelvision/quality', q); } catch {}
  };

  const toggleTutorial = async (val: boolean) => {
    setTutorialEnabled(val);
    try {
      if (val) {
        await AsyncStorage.multiSet([
          ['@padelvision/tutorial_seen',         'false'],
          ['@padelvision/tutorial_always_show',  'true'],
        ]);
      } else {
        await AsyncStorage.setItem('@padelvision/tutorial_always_show', 'false');
      }
    } catch {}
  };

  const initial = profileName.charAt(0).toUpperCase();

  const openProfileEdit = () => {
    setEditName(profileName);
    setTempColor(avatarColor);
    setTempImage(profileImage);
    setProfileModal(true);
  };

  const saveProfile = async () => {
    const newName = editName.trim() || profileName;
    setProfileName(newName);
    setAvatarColor(tempColor);
    setProfileImage(tempImage);
    setProfileModal(false);
    try {
      const pairs: [string, string][] = [
        [`${profilePrefix}_name`,  newName],
        [`${profilePrefix}_color`, tempColor],
      ];
      if (tempImage) {
        pairs.push([`${profilePrefix}_image`, tempImage]);
      } else {
        await AsyncStorage.removeItem(`${profilePrefix}_image`);
      }
      await AsyncStorage.multiSet(pairs);
    } catch {}
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        <View style={s.header}>
          <Text style={s.title}>{t('settings.title')}</Text>
          <Text style={s.sub}>{t('settings.subtitle')}</Text>
        </View>

        {/* Profile card */}
        <View style={s.profileCard}>
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={[s.avatarImg, { borderColor: avatarColor + '66' }]} />
          ) : (
            <View style={[s.avatar, { backgroundColor: avatarColor + '22', borderColor: avatarColor + '66' }]}>
              <Text style={[s.avatarInitial, { color: avatarColor }]}>{initial}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profileName}</Text>
            <Text style={s.profileSub}>{t('settings.skillLevel')} P4 · {matches.length} {t('settings.matchesPlayed')}</Text>
          </View>
          <TouchableOpacity style={[s.editBtn, { borderColor: colors.primary }]} onPress={openProfileEdit}>
            <Text style={[s.editBtnText, { color: colors.primary }]}>{t('settings.editProfile')}</Text>
          </TouchableOpacity>
        </View>

        {/* Account section */}
        {!!userEmail && (
          <>
            <Text style={s.sectionTitle}>Konto</Text>
            <View style={s.section}>
              {!!profileName && (
                <>
                  <SettingRow icon="person-outline" iconBg={colors.primaryDim} iconColor={colors.primary} label="Benutzername" value={profileName} colors={colors} s={s} onPress={() => {}} />
                  <View style={s.divider} />
                </>
              )}
              <SettingRow icon="mail-outline" iconBg={colors.primaryDim} iconColor={colors.primary} label="E-Mail" value={userEmail} colors={colors} s={s} onPress={() => {}} />
              <View style={s.divider} />
              <SettingRow icon="lock-closed-outline" iconBg={colors.cardAlt} iconColor={colors.textSec} label="Passwort ändern" value="" colors={colors} s={s} onPress={() => { setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setPasswordSuccess(false); setPasswordModal(true); }} />
            </View>
          </>
        )}

        {/* Pro Banner — only shown when not yet pro */}
        {!isPro && (
          <TouchableOpacity style={s.proBanner} onPress={() => navigation.navigate('Paywall')} activeOpacity={0.85}>
            <View style={s.proLeft}>
              <Text style={s.proTitle}>PadelVision Pro</Text>
              <Text style={s.proSub}>KI-Analyse · Shot Timeline · Unbegrenzte Matches</Text>
            </View>
            <View style={s.proArrow}>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </View>
          </TouchableOpacity>
        )}

        {/* Appearance */}
        <Text style={s.sectionTitle}>{t('settings.appearance')}</Text>
        <View style={s.section}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: colors.cardAlt }]}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={18} color={colors.textSec} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>{t('settings.darkMode')}</Text>
              <Text style={s.settingDesc}>{t('settings.darkModeDesc')}</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={s.divider} />
          <SettingRow icon="globe-outline" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.language')} value={LANGUAGE_OPTIONS.find(l => l.code === locale)?.label ?? 'English'} colors={colors} s={s} onPress={() => setLanguageModal(true)} />
        </View>

        {/* Analysis */}
        <Text style={s.sectionTitle}>{t('settings.analysis')}</Text>
        <View style={s.section}>
          <SettingToggle icon="eye" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.autoHighlight')} desc={t('settings.autoHighlightDesc')} colors={colors} s={s} value={autoHighlight} onValueChange={(v: boolean) => { setAutoHighlight(v); saveToggle('@padelvision/toggle_autoHighlight', v); }} />
          <View style={s.divider} />
          <SettingToggle icon="warning" iconBg={colors.dangerDim} iconColor={colors.danger} label={t('settings.errorNotifications')} desc={t('settings.errorNotificationsDesc')} colors={colors} s={s} value={errorNotifications} onValueChange={(v: boolean) => { setErrorNotifications(v); saveToggle('@padelvision/toggle_errorNotifications', v); }} />
          <View style={s.divider} />
          <SettingToggle icon="analytics" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.liveTracking')} desc={t('settings.liveTrackingDesc')} colors={colors} s={s} value={liveTracking} onValueChange={(v: boolean) => { setLiveTracking(v); saveToggle('@padelvision/toggle_liveTracking', v); }} />
        </View>

        {/* Recording */}
        <Text style={s.sectionTitle}>{t('settings.recording')}</Text>
        <View style={s.section}>
          <SettingRow icon="videocam" iconBg={colors.dangerDim} iconColor={colors.danger} label={t('settings.videoQuality')} value={selectedQuality} colors={colors} s={s} onPress={() => setQualityModal(true)} />
          <View style={s.divider} />
          <SettingToggle icon="mic" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.audioRecording')} desc={t('settings.audioRecordingDesc')} colors={colors} s={s} value={audioRecording} onValueChange={(v: boolean) => { setAudioRecording(v); saveToggle('@padelvision/toggle_audioRecording', v); }} />
          <View style={s.divider} />
          <SettingRow icon="save" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.autoSave')} value="iCloud / Google Drive" colors={colors} s={s} onPress={() => {}} />
        </View>

        {/* Notifications */}
        <Text style={s.sectionTitle}>{t('settings.notifications')}</Text>
        <View style={s.section}>
          <SettingToggle icon="notifications" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.matchReminders')} desc={t('settings.matchRemindersDesc')} colors={colors} s={s} value={matchReminders} onValueChange={(v: boolean) => { setMatchReminders(v); saveToggle('@padelvision/toggle_matchReminders', v); }} />
          <View style={s.divider} />
          <SettingToggle icon="trophy" iconBg={colors.primaryDim} iconColor={colors.primary} label={t('settings.weeklySummary')} desc={t('settings.weeklySummaryDesc')} colors={colors} s={s} value={weeklySummary} onValueChange={(v: boolean) => { setWeeklySummary(v); saveToggle('@padelvision/toggle_weeklySummary', v); }} />
        </View>

        {/* Tutorial */}
        <Text style={s.sectionTitle}>{t('settings.tutorial')}</Text>
        <View style={s.section}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: colors.primaryDim }]}>
              <Ionicons name="play-circle" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.settingLabel}>{t('settings.tutorialShow')}</Text>
              <Text style={s.settingDesc}>{t('settings.tutorialShowDesc')}</Text>
            </View>
            <Switch
              value={tutorialEnabled}
              onValueChange={toggleTutorial}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* About */}
        <Text style={s.sectionTitle}>{t('settings.about')}</Text>
        <View style={s.section}>
          <SettingRow icon="information-circle" iconBg={colors.cardAlt} iconColor={colors.textSec} label={t('settings.version')} value="1.0.0 (Demo)" colors={colors} s={s} onPress={() => {}} />
          <View style={s.divider} />
          <SettingRow icon="shield-checkmark" iconBg={colors.cardAlt} iconColor={colors.textSec} label={t('settings.privacyPolicy')} value="" colors={colors} s={s} onPress={() => setPolicyModal('privacy')} />
          <View style={s.divider} />
          <SettingRow icon="document-text" iconBg={colors.cardAlt} iconColor={colors.textSec} label={t('settings.terms')} value="" colors={colors} s={s} onPress={() => setPolicyModal('terms')} />
        </View>

        <TouchableOpacity style={[s.signOutBtn, { borderColor: colors.danger + '66' }]} onPress={signOut} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[s.signOutText, { color: colors.danger }]}>{t('settings.signOut')}</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal visible={profileModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('settings.editProfile')}</Text>
              <TouchableOpacity onPress={() => setProfileModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSec} />
              </TouchableOpacity>
            </View>

            {/* Live avatar preview */}
            <View style={s.avatarPreviewRow}>
              {tempImage ? (
                <Image source={{ uri: tempImage }} style={[s.avatarLargeImg, { borderColor: tempColor + '88' }]} />
              ) : (
                <View style={[s.avatarLarge, { backgroundColor: tempColor + '22', borderColor: tempColor + '88' }]}>
                  <Text style={[s.avatarInitialLarge, { color: tempColor }]}>
                    {editName.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={[s.addPhotoBtn, { borderColor: colors.border }]} onPress={pickImage} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={16} color={colors.primary} />
                <Text style={[s.addPhotoBtnText, { color: colors.primary }]}>{tempImage ? t('settings.changePhoto') : t('settings.addPhoto')}</Text>
              </TouchableOpacity>
            </View>

            {/* Color picker */}
            <Text style={s.inputLabel}>{t('settings.avatarColor')}</Text>
            <View style={s.colorRow}>
              {AVATAR_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[s.colorDot, { backgroundColor: color }, tempColor === color && s.colorDotSelected]}
                  onPress={() => setTempColor(color)}
                />
              ))}
            </View>

            {/* Name input */}
            <Text style={s.inputLabel}>{t('settings.name')}</Text>
            <TextInput
              style={[s.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
            />

            <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary }]} onPress={saveProfile}>
              <Text style={s.modalBtnText}>{t('settings.saveProfile')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Video Quality Modal */}
      <Modal visible={qualityModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('settings.videoQualityTitle')}</Text>
              <TouchableOpacity onPress={() => setQualityModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSec} />
              </TouchableOpacity>
            </View>
            {QUALITIES.map(q => (
              <TouchableOpacity key={q} style={s.qualityRow} onPress={() => changeQuality(q)} activeOpacity={0.7}>
                <View style={s.qualityLeft}>
                  <Text style={[s.qualityLabel, selectedQuality === q && { color: colors.primary }]}>{q}</Text>
                  {q === '1080p 60fps' && <Text style={s.qualityTag}>{t('settings.recommended')}</Text>}
                </View>
                {selectedQuality === q && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Privacy / Terms Modal */}
      <Modal visible={policyModal !== null} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{policyModal === 'privacy' ? t('settings.privacyPolicyTitle') : t('settings.termsTitle')}</Text>
              <TouchableOpacity onPress={() => setPolicyModal(null)}>
                <Ionicons name="close" size={22} color={colors.textSec} />
              </TouchableOpacity>
            </View>
            <Text style={s.policyText}>{policyModal === 'privacy' ? PRIVACY_TEXT : TERMS_TEXT}</Text>
          </View>
        </View>
      </Modal>
      {/* Password Change Modal */}
      <Modal visible={passwordModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Passwort ändern</Text>
              <TouchableOpacity onPress={() => setPasswordModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSec} />
              </TouchableOpacity>
            </View>
            {passwordSuccess ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Passwort gespeichert</Text>
              </View>
            ) : (
              <>
                <Text style={s.inputLabel}>Neues Passwort</Text>
                <TextInput
                  style={[s.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg, marginBottom: 14 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mindestens 6 Zeichen"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <Text style={s.inputLabel}>Passwort bestätigen</Text>
                <TextInput
                  style={[s.nameInput, { color: colors.text, borderColor: passwordError ? colors.danger : colors.border, backgroundColor: colors.bg }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nochmal eingeben"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {!!passwordError && (
                  <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600', marginTop: 8 }}>{passwordError}</Text>
                )}
                <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary }]} onPress={changePassword}>
                  <Text style={s.modalBtnText}>Speichern</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal visible={languageModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{t('settings.selectLanguage')}</Text>
              <TouchableOpacity onPress={() => setLanguageModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSec} />
              </TouchableOpacity>
            </View>
            {LANGUAGE_OPTIONS.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={s.qualityRow}
                onPress={() => { setLocale(lang.code); setLanguageModal(false); }}
                activeOpacity={0.7}
              >
                <View style={s.qualityLeft}>
                  <Text style={[s.qualityLabel, locale === lang.code && { color: colors.primary }]}>{lang.label}</Text>
                  <Text style={s.qualityTag}>{lang.region}</Text>
                </View>
                {locale === lang.code && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingToggle({ icon, iconBg, iconColor, label, desc, colors, s, value, onValueChange }: any) {
  return (
    <View style={s.settingRow}>
      <View style={[s.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.settingLabel}>{label}</Text>
        <Text style={s.settingDesc}>{desc}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#fff" />
    </View>
  );
}

function SettingRow({ icon, iconBg, iconColor, label, value, colors, s, onPress }: any) {
  return (
    <TouchableOpacity style={s.settingRow} activeOpacity={0.7} onPress={onPress}>
      <View style={[s.settingIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={s.settingLabel}>{label}</Text>
      <View style={s.settingRight}>
        {value ? <Text style={s.settingValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 16 },
    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
    headerSub: { fontSize: 11, color: colors.primary, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as const, marginBottom: 3 },
    title: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
    sub: { fontSize: 13, color: colors.textSec, marginTop: 2 },

    profileCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    avatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
    avatarInitial: { fontSize: 22, fontWeight: '800' },
    profileName: { color: colors.text, fontWeight: '700', fontSize: 17 },
    profileSub: { color: colors.textSec, fontSize: 13, marginTop: 2 },
    editBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
    editBtnText: { fontWeight: '700', fontSize: 13 },

    sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSec, marginLeft: 20, marginTop: 20, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
    section: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    settingLabel: { color: colors.text, fontWeight: '600', fontSize: 15, flex: 1 },
    settingDesc: { color: colors.textSec, fontSize: 12, marginTop: 1 },
    settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settingValue: { color: colors.textSec, fontSize: 13 },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 62 },

    proBanner: { marginHorizontal: 16, marginTop: 8, marginBottom: 8, backgroundColor: '#00E87D', borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    proLeft: { flex: 1 },
    proTitle: { color: '#000', fontWeight: '800', fontSize: 17, marginBottom: 3 },
    proSub: { color: '#00000088', fontSize: 12, fontWeight: '600' },
    proArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },

    signOutBtn: { marginHorizontal: 16, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 14 },
    signOutText: { fontWeight: '700', fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 16, marginTop: 20 },
    modalBtnText: { fontWeight: '700', fontSize: 15, color: '#fff' },

    avatarPreviewRow: { alignItems: 'center', marginBottom: 20 },
    avatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
    avatarInitialLarge: { fontSize: 32, fontWeight: '800' },

    inputLabel: { fontSize: 13, fontWeight: '700', color: colors.textSec, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
    colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    colorDot: { width: 36, height: 36, borderRadius: 18 },
    colorDotSelected: { transform: [{ scale: 1.2 }], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
    nameInput: { borderWidth: 1.5, borderRadius: 12, padding: 14, fontSize: 16, fontWeight: '600' },

    qualityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    qualityLeft: { gap: 2 },
    qualityLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
    qualityTag: { fontSize: 11, color: colors.primary, fontWeight: '700' },
    policyText: { color: colors.textSec, fontSize: 14, lineHeight: 22 },
    avatarImg: { width: 52, height: 52, borderRadius: 26, borderWidth: 2 },
    avatarLargeImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3 },
    addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
    addPhotoBtnText: { fontWeight: '700', fontSize: 13 },
  });
}
