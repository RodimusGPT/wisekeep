/**
 * Web-Only Admin Panel
 *
 * Access: https://yourapp.com/admin (web only)
 * Authentication: Email/password via Supabase Auth
 * Features:
 * - Look up users by support code
 * - Grant/revoke VIP access
 * - View user details and usage
 *
 * Security:
 * - .web.tsx extension = excluded from iOS/Android builds
 * - Requires Supabase Auth login
 * - Admin role check in database
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { BigButton } from '@/components/ui';
import {
  lookupUserBySupportCode,
  adminSetUserTier,
  adminGetUserRecordings,
  AdminUserInfo,
  AdminRecordingsResponse,
  supabaseAdmin,  // Use admin-specific client with separate session storage
} from '@/services/supabase';
import { isValidSupportCodeFormat } from '@/utils';

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Search state
  const [supportCodeInput, setSupportCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUserInfo | null>(null);

  // Action state
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState('');

  // Recordings pagination state
  const [recordingsData, setRecordingsData] = useState<AdminRecordingsResponse | null>(null);
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(false);

  const backgroundColor = isDark ? Colors.backgroundDark : Colors.background;
  const textColor = isDark ? Colors.textDark : Colors.text;
  const secondaryColor = isDark ? Colors.textSecondaryDark : Colors.textSecondary;
  const cardBackground = isDark ? Colors.cardDark : Colors.card;

  // Check authentication status on mount
  // Uses supabaseAdmin which has completely separate session storage from user app
  useEffect(() => {
    const checkAuth = async () => {
      console.log('Admin: Checking auth on mount...');
      const { data: { session } } = await supabaseAdmin.auth.getSession();
      console.log('Admin: Session found:', !!session, session?.user?.email);

      setIsAuthenticated(!!session);
      setIsCheckingAuth(false);
    };
    checkAuth();

    // Listen for auth changes (only sees admin session changes, not user app)
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange((event, session) => {
      console.log('Admin: Auth state changed:', event, !!session);
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle email/password login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        Alert.alert('Login Failed', error.message);
        return;
      }

      if (data.session) {
        setIsAuthenticated(true);
        setEmail('');
        setPassword('');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  // Handle logout
  const handleLogout = async () => {
    // Use window.confirm for web compatibility
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to log out?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Log Out', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      console.log('Admin: Starting logout process...');

      // Sign out from admin Supabase client (only clears admin session, not user session)
      const { error: signOutError } = await supabaseAdmin.auth.signOut({ scope: 'local' });

      if (signOutError) {
        console.error('SignOut error:', signOutError);
        throw signOutError;
      }

      console.log('Admin: SignOut successful');

      // Only clear admin-specific storage key (don't touch user session)
      if (Platform.OS === 'web') {
        localStorage.removeItem('wisekeep-admin-auth');
        console.log('Admin: Cleared admin session storage');
      }

      // Clear local state
      setIsAuthenticated(false);
      setFoundUser(null);
      setSupportCodeInput('');
      setAdminKeyInput('');

      // Reload to ensure clean state
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to log out. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to log out. Please try again.');
      }
    }
  };

  // Fetch user recordings with pagination
  const fetchRecordings = async (userId: string, page: number = 1) => {
    setIsLoadingRecordings(true);
    try {
      const data = await adminGetUserRecordings(userId, page, 15);
      setRecordingsData(data);
      setRecordingsPage(page);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setIsLoadingRecordings(false);
    }
  };

  // Search for user by support code
  const handleSearch = async () => {
    if (!supportCodeInput.trim()) {
      Alert.alert('Error', 'Please enter a support code');
      return;
    }

    if (!isValidSupportCodeFormat(supportCodeInput)) {
      Alert.alert('Error', 'Invalid support code format. Expected: WK-XXXX');
      return;
    }

    setIsSearching(true);
    setFoundUser(null);

    try {
      const user = await lookupUserBySupportCode(supportCodeInput.trim());

      if (user) {
        setFoundUser(user);
        // Reset and fetch recordings for the found user
        setRecordingsData(null);
        setRecordingsPage(1);
        fetchRecordings(user.id, 1);
      } else {
        Alert.alert('Not Found', 'No user found with that support code');
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search. Check console for details.');
    } finally {
      setIsSearching(false);
    }
  };

  // Update user tier
  const handleSetTier = async (tier: 'free' | 'premium' | 'vip') => {
    if (!foundUser) return;

    if (!adminKeyInput.trim()) {
      Alert.alert('Error', 'Please enter admin key');
      return;
    }

    setIsUpdating(true);

    try {
      const result = await adminSetUserTier(
        foundUser.support_code,
        tier,
        adminKeyInput.trim()
      );

      if (result.success) {
        Alert.alert('Success', result.message);
        // Refresh user data
        const updatedUser = await lookupUserBySupportCode(foundUser.support_code);
        if (updatedUser) {
          setFoundUser(updatedUser);
        }
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Failed to update tier');
    } finally {
      setIsUpdating(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Format datetime with time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Format duration in seconds to mm:ss or hh:mm:ss
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pinContainer}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>

          <View style={styles.pinContent}>
            <Ionicons name="shield-checkmark" size={64} color={Colors.primary} />
            <Text style={[styles.pinTitle, { color: textColor }]}>Admin Login</Text>
            <Text style={[styles.pinSubtitle, { color: secondaryColor }]}>
              Web-only admin panel
            </Text>

            <TextInput
              style={[
                styles.loginInput,
                {
                  color: textColor,
                  backgroundColor: cardBackground,
                  borderColor: Colors.border,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={secondaryColor}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />

            <TextInput
              style={[
                styles.loginInput,
                {
                  color: textColor,
                  backgroundColor: cardBackground,
                  borderColor: Colors.border,
                },
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={secondaryColor}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={handleLogin}
            />

            <BigButton
              title="Login"
              onPress={handleLogin}
              variant="primary"
              style={styles.pinButton}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Admin panel
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={textColor} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: textColor }]}>Admin Panel</Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search Section */}
          <View style={[styles.section, { backgroundColor: cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Look Up User
            </Text>

            <View style={styles.searchRow}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? Colors.backgroundDark : Colors.background,
                    borderColor: Colors.border,
                  },
                ]}
                value={supportCodeInput}
                onChangeText={setSupportCodeInput}
                placeholder="WK-XXXX"
                placeholderTextColor={secondaryColor}
                autoCapitalize="characters"
                onSubmitEditing={handleSearch}
              />

              <TouchableOpacity
                style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
                onPress={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="search" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* User Details */}
          {foundUser && (
            <View style={[styles.section, { backgroundColor: cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                User Details
              </Text>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: secondaryColor }]}>
                  Support Code
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {foundUser.support_code}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: secondaryColor }]}>
                  Current Tier
                </Text>
                <View
                  style={[
                    styles.tierBadge,
                    foundUser.tier === 'vip' && styles.tierBadgeVip,
                    foundUser.tier === 'premium' && styles.tierBadgePremium,
                  ]}
                >
                  <Text style={styles.tierBadgeText}>
                    {foundUser.tier.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: secondaryColor }]}>
                  Created
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {formatDate(foundUser.created_at)}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: secondaryColor }]}>
                  Total Recordings
                </Text>
                <Text style={[styles.detailValue, { color: textColor }]}>
                  {foundUser.total_recordings} ({foundUser.deleted_recordings} deleted)
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: secondaryColor }]}>
                  User ID
                </Text>
                <Text
                  style={[styles.detailValue, styles.detailValueSmall, { color: secondaryColor }]}
                  numberOfLines={1}
                >
                  {foundUser.id}
                </Text>
              </View>
            </View>
          )}

          {/* Set Tier */}
          {foundUser && (
            <View style={[styles.section, { backgroundColor: cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Set Tier
              </Text>

              <TextInput
                style={[
                  styles.adminKeyInput,
                  {
                    color: textColor,
                    backgroundColor: isDark ? Colors.backgroundDark : Colors.background,
                    borderColor: Colors.border,
                  },
                ]}
                value={adminKeyInput}
                onChangeText={setAdminKeyInput}
                placeholder="Admin Key"
                placeholderTextColor={secondaryColor}
                secureTextEntry
              />

              <View style={styles.tierButtons}>
                <TouchableOpacity
                  style={[
                    styles.tierButton,
                    foundUser.tier === 'free' && styles.tierButtonActive,
                  ]}
                  onPress={() => handleSetTier('free')}
                  disabled={isUpdating}
                >
                  <Text style={styles.tierButtonText}>FREE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tierButton,
                    styles.tierButtonPremium,
                    foundUser.tier === 'premium' && styles.tierButtonActive,
                  ]}
                  onPress={() => handleSetTier('premium')}
                  disabled={isUpdating}
                >
                  <Text style={styles.tierButtonText}>PREMIUM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tierButton,
                    styles.tierButtonVip,
                    foundUser.tier === 'vip' && styles.tierButtonActive,
                  ]}
                  onPress={() => handleSetTier('vip')}
                  disabled={isUpdating}
                >
                  <Text style={styles.tierButtonText}>VIP</Text>
                </TouchableOpacity>
              </View>

              {isUpdating && (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={styles.loadingIndicator}
                />
              )}
            </View>
          )}

          {/* Usage History */}
          {foundUser && foundUser.usage_history && foundUser.usage_history.length > 0 && (
            <View style={[styles.section, { backgroundColor: cardBackground }]}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Usage History
              </Text>

              {foundUser.usage_history.map((usage, index) => (
                <View key={index} style={[styles.usageRow, index > 0 && styles.usageRowBorder]}>
                  <Text style={[styles.usagePeriod, { color: textColor }]}>
                    {usage.period_start}
                  </Text>
                  <View style={styles.usageStats}>
                    <Text style={[styles.usageStat, { color: secondaryColor }]}>
                      {Number(usage.minutes_recorded).toFixed(1)} min
                    </Text>
                    <Text style={[styles.usageStat, { color: secondaryColor }]}>
                      {usage.recording_count} recordings
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recordings with Pagination */}
          {foundUser && (
            <View style={[styles.section, { backgroundColor: cardBackground }]}>
              <View style={styles.recordingsSectionHeader}>
                <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
                  Recordings
                </Text>
                {recordingsData && (
                  <Text style={[styles.recordingsCount, { color: secondaryColor }]}>
                    {recordingsData.total} total
                  </Text>
                )}
              </View>

              {/* Table Header */}
              <View style={[styles.tableHeader, { borderBottomColor: Colors.border }]}>
                <Text style={[styles.tableHeaderCell, styles.tableColTime, { color: secondaryColor }]}>
                  Time
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableColDuration, { color: secondaryColor }]}>
                  Duration
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableColStatus, { color: secondaryColor, textAlign: 'right' }]}>
                  Status
                </Text>
              </View>

              {/* Loading State */}
              {isLoadingRecordings && (
                <View style={styles.recordingsLoading}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              )}

              {/* Recordings List */}
              {!isLoadingRecordings && recordingsData && recordingsData.recordings.map((recording, index) => (
                <View
                  key={recording.id}
                  style={[
                    styles.tableRow,
                    index > 0 && { borderTopWidth: 1, borderTopColor: Colors.border },
                    recording.is_deleted && styles.recordingDeleted
                  ]}
                >
                  <Text style={[
                    styles.tableCell,
                    styles.tableColTime,
                    { color: recording.is_deleted ? secondaryColor : textColor }
                  ]}>
                    {formatDateTime(recording.created_at)}
                  </Text>
                  <Text style={[
                    styles.tableCell,
                    styles.tableColDuration,
                    { color: recording.is_deleted ? secondaryColor : textColor }
                  ]}>
                    {formatDuration(recording.duration)}
                  </Text>
                  <View style={[styles.tableColStatus, styles.statusCell]}>
                    {recording.is_deleted ? (
                      <View style={styles.deletedBadge}>
                        <Text style={styles.deletedBadgeText}>DELETED</Text>
                      </View>
                    ) : (
                      <Text style={[styles.statusText, { color: secondaryColor }]}>
                        {recording.status}
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              {/* Empty State */}
              {!isLoadingRecordings && recordingsData && recordingsData.recordings.length === 0 && (
                <Text style={[styles.emptyText, { color: secondaryColor }]}>
                  No recordings found
                </Text>
              )}

              {/* Pagination Controls */}
              {recordingsData && recordingsData.total_pages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      recordingsPage <= 1 && styles.paginationButtonDisabled
                    ]}
                    onPress={() => foundUser && fetchRecordings(foundUser.id, recordingsPage - 1)}
                    disabled={recordingsPage <= 1 || isLoadingRecordings}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={recordingsPage <= 1 ? secondaryColor : Colors.primary}
                    />
                    <Text style={[
                      styles.paginationButtonText,
                      { color: recordingsPage <= 1 ? secondaryColor : Colors.primary }
                    ]}>
                      Previous
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.paginationInfo, { color: textColor }]}>
                    Page {recordingsPage} of {recordingsData.total_pages}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.paginationButton,
                      recordingsPage >= recordingsData.total_pages && styles.paginationButtonDisabled
                    ]}
                    onPress={() => foundUser && fetchRecordings(foundUser.id, recordingsPage + 1)}
                    disabled={recordingsPage >= recordingsData.total_pages || isLoadingRecordings}
                  >
                    <Text style={[
                      styles.paginationButtonText,
                      { color: recordingsPage >= recordingsData.total_pages ? secondaryColor : Colors.primary }
                    ]}>
                      Next
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={recordingsPage >= recordingsData.total_pages ? secondaryColor : Colors.primary}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  logoutButton: {
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // PIN screen
  pinContainer: {
    flex: 1,
  },
  pinContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  loginInput: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  pinButton: {
    marginTop: 8,
    width: '100%',
    maxWidth: 400,
  },

  // Sections
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },

  // Details
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.1)',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValueSmall: {
    fontSize: 12,
    fontWeight: '400',
    maxWidth: '60%',
  },

  // Tier badges
  tierBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeVip: {
    backgroundColor: '#FFD700',
  },
  tierBadgePremium: {
    backgroundColor: Colors.primary,
  },
  tierBadgeText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 12,
  },

  // Admin key
  adminKeyInput: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  // Tier buttons
  tierButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tierButton: {
    flex: 1,
    backgroundColor: Colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  tierButtonPremium: {
    backgroundColor: Colors.primary,
  },
  tierButtonVip: {
    backgroundColor: '#FFD700',
  },
  tierButtonActive: {
    borderWidth: 3,
    borderColor: '#000000',
  },
  tierButtonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingIndicator: {
    marginTop: 16,
  },

  // Usage history
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  usageRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  usagePeriod: {
    fontSize: 14,
    fontWeight: '500',
  },
  usageStats: {
    flexDirection: 'row',
    gap: 16,
  },
  usageStat: {
    fontSize: 13,
  },

  // Recordings section
  recordingsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingsCount: {
    fontSize: 14,
  },
  recordingsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  recordingDeleted: {
    opacity: 0.6,
  },

  // Table styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
  },
  tableColTime: {
    flex: 2.5,
  },
  tableColDuration: {
    flex: 1.2,
  },
  tableColStatus: {
    flex: 1.2,
    alignItems: 'flex-end',
  },
  statusCell: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statusText: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },

  // Deleted badge
  deletedBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deletedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  paginationInfo: {
    fontSize: 14,
  },
});
