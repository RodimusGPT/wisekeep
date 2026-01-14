export type Language = 'zh-TW' | 'en';

export interface Translations {
  // App
  appName: string;
  tagline: string;

  // Welcome/Onboarding
  welcome: string;
  welcomeTagline: string;
  selectLanguage: string;
  microphonePermissionTitle: string;
  microphonePermissionMessage: string;
  grantPermission: string;
  continueButton: string;

  // Navigation
  tabRecord: string;
  tabLibrary: string;
  tabSettings: string;

  // Home/Recording
  tapToRecord: string;
  recording: string;
  tapToStop: string;
  recentRecordings: string;
  viewAll: string;
  noRecordings: string;
  noRecordingsMessage: string;

  // Processing
  processing: string;
  saving: string;
  uploadingAudio: string;
  takingNotes: string;
  findingKeyPoints: string;
  mayTakeFewMinutes: string;
  processingComplete: string;

  // Recording Detail
  summary: string;
  notes: string;
  summaryHeader: string;
  notesHeader: string;
  tapNotesForMore: string;
  speaker: string;
  addLabel: string;
  edit: string;
  share: string;
  delete: string;
  regenerate: string;
  transcribe: string;
  summarize: string;
  recordingSaved: string;
  transcribePromptTitle: string;
  transcribePromptMessage: string;
  summarizePromptTitle: string;
  summarizePromptMessage: string;
  noSummaryYet: string;
  aiMinutesRemaining: string;
  unlimited: string;

  // Playback
  play: string;
  pause: string;
  normalSpeed: string;
  slowSpeed: string;
  tapLineToHear: string;

  // Library
  myRecordings: string;
  search: string;
  searchPlaceholder: string;
  notesReady: string;
  summaryReady: string;
  processingStatus: string;

  // Sharing
  shareWithFamily: string;
  shareSummary: string;
  shareNotes: string;
  shareAudio: string;
  downloadAudio: string;
  convertingAudio: string;
  copyText: string;
  copied: string;
  noSummaryToShare: string;
  noNotesToShare: string;
  failedToCopy: string;
  audioSharingNotAvailableWeb: string;
  sharingNotAvailable: string;
  failedToShareAudio: string;

  // Settings
  settings: string;
  language: string;
  textSize: string;
  textSizeSmall: string;
  textSizeMedium: string;
  textSizeLarge: string;
  help: string;
  about: string;
  aboutWiseKeep: string;
  version: string;

  // Confirmations & Alerts
  confirmDelete: string;
  confirmDeleteMessage: string;
  cancel: string;
  confirm: string;

  // Phone call interruption
  incomingCall: string;
  answerAndStop: string;
  declineAndContinue: string;

  // Offline/Errors
  noInternet: string;
  noInternetMessage: string;
  willProcessWhenConnected: string;
  lastRecordingSaved: string;
  error: string;
  tryAgain: string;
  storageFull: string;
  storageFullMessage: string;

  // First recording education
  recordingReady: string;
  notesExplanation: string;
  summaryExplanation: string;
  viewRecording: string;

  // Time formatting
  today: string;
  yesterday: string;
  daysAgo: string;

  // Duration
  hours: string;
  minutes: string;
  seconds: string;

  // Payments
  upgradeToPremium: string;
  restorePurchases: string;
  unlimitedRecordings: string;
  purchaseRestored: string;
  noPurchasesToRestore: string;
  purchaseFailed: string;

  // Support
  supportCode: string;
  codeCopied: string;
}

export const translations: Record<Language, Translations> = {
  'zh-TW': {
    // App
    appName: '智守',
    tagline: '錄音、筆記、記住',

    // Welcome/Onboarding
    welcome: '歡迎使用智守',
    welcomeTagline: '讓智守幫你記住重要的事',
    selectLanguage: '選擇語言',
    microphonePermissionTitle: '需要麥克風權限',
    microphonePermissionMessage: '我們需要使用麥克風來錄音',
    grantPermission: '允許使用麥克風',
    continueButton: '繼續',

    // Navigation
    tabRecord: '錄音',
    tabLibrary: '錄音庫',
    tabSettings: '設定',

    // Home/Recording
    tapToRecord: '點擊開始錄音',
    recording: '錄音中',
    tapToStop: '點擊結束',
    recentRecordings: '最近錄音',
    viewAll: '查看全部',
    noRecordings: '還沒有錄音',
    noRecordingsMessage: '點擊上方的大按鈕開始您的第一次錄音',

    // Processing
    processing: '處理中',
    saving: '儲存中',
    uploadingAudio: '正在上傳...',
    takingNotes: '正在做筆記...',
    findingKeyPoints: '正在整理重點...',
    mayTakeFewMinutes: '這可能需要幾分鐘',
    processingComplete: '處理完成',

    // Recording Detail
    summary: '重點摘要',
    notes: '筆記',
    summaryHeader: '重點摘要',
    notesHeader: '筆記',
    tapNotesForMore: '點擊「筆記」查看更多內容',
    speaker: '說話者',
    addLabel: '點擊添加標籤',
    edit: '編輯',
    share: '分享',
    delete: '刪除',
    regenerate: '重新整理',
    transcribe: '轉成文字',
    summarize: '整理重點',
    recordingSaved: '錄音已儲存，點擊下方按鈕轉成文字',
    transcribePromptTitle: '轉成文字',
    transcribePromptMessage: '這將使用約 {minutes} 分鐘的 AI 處理額度。',
    summarizePromptTitle: '整理重點',
    summarizePromptMessage: '將根據文字筆記整理重點。此功能不消耗 AI 額度。',
    noSummaryYet: '尚未產生摘要，請點擊下方「整理重點」按鈕',
    aiMinutesRemaining: '剩餘額度：{remaining} 分鐘',
    unlimited: '無限',

    // Playback
    play: '播放',
    pause: '暫停',
    normalSpeed: '正常',
    slowSpeed: '慢速',
    tapLineToHear: '點擊任何一行可以聽該段錄音',

    // Library
    myRecordings: '我的錄音',
    search: '搜尋',
    searchPlaceholder: '搜尋錄音...',
    notesReady: '筆記完成',
    summaryReady: '重點摘要',
    processingStatus: '處理中',

    // Sharing
    shareWithFamily: '分享內容',
    shareSummary: '拷貝摘要內容',
    shareNotes: '拷貝筆記內容',
    shareAudio: '分享錄音',
    downloadAudio: '下載錄音',
    convertingAudio: '轉換中...',
    copyText: '複製文字',
    copied: '已複製',
    noSummaryToShare: '沒有摘要可以分享',
    noNotesToShare: '沒有筆記可以分享',
    failedToCopy: '複製失敗',
    audioSharingNotAvailableWeb: '網頁版無法分享錄音，請使用手機應用程式',
    sharingNotAvailable: '無法分享',
    failedToShareAudio: '分享錄音失敗',

    // Settings
    settings: '設定',
    language: '語言',
    textSize: '字體大小',
    textSizeSmall: '小',
    textSizeMedium: '中',
    textSizeLarge: '大',
    help: '幫助',
    about: '關於',
    aboutWiseKeep: '關於智守',
    version: '版本',

    // Confirmations & Alerts
    confirmDelete: '確定要刪除？',
    confirmDeleteMessage: '此錄音將被永久刪除，無法恢復。',
    cancel: '取消',
    confirm: '確定',

    // Phone call interruption
    incomingCall: '接聽電話？',
    answerAndStop: '接聽並停止錄音',
    declineAndContinue: '拒接繼續錄音',

    // Offline/Errors
    noInternet: '無法連線網路',
    noInternetMessage: '您的錄音已安全保存，連線後將自動處理。',
    willProcessWhenConnected: '連線後將自動處理',
    lastRecordingSaved: '上次錄音已保存',
    error: '發生錯誤',
    tryAgain: '再試一次',
    storageFull: '儲存空間不足',
    storageFullMessage: '請刪除一些舊錄音以繼續錄製新的。',

    // First recording education
    recordingReady: '您的錄音已準備好！',
    notesExplanation: '幫您記下對話內容',
    summaryExplanation: '最重要的幾個重點',
    viewRecording: '查看錄音',

    // Time formatting
    today: '今天',
    yesterday: '昨天',
    daysAgo: '天前',

    // Duration
    hours: '小時',
    minutes: '分鐘',
    seconds: '秒',

    // Payments
    upgradeToPremium: '升級無限制',
    restorePurchases: '恢復購買',
    unlimitedRecordings: '無限錄音時間',
    purchaseRestored: '購買已恢復',
    noPurchasesToRestore: '沒有購買記錄可恢復',
    purchaseFailed: '購買失敗，請重試',

    // Support
    supportCode: '支援代碼',
    codeCopied: '代碼已複製',
  },

  'en': {
    // App
    appName: 'WiseKeep',
    tagline: 'Record, Notes, Remember',

    // Welcome/Onboarding
    welcome: 'Welcome to WiseKeep',
    welcomeTagline: 'WiseKeep helps you remember what matters',
    selectLanguage: 'Select Language',
    microphonePermissionTitle: 'Microphone Permission Needed',
    microphonePermissionMessage: 'We need microphone access to record for you',
    grantPermission: 'Allow Microphone',
    continueButton: 'Continue',

    // Navigation
    tabRecord: 'Record',
    tabLibrary: 'My Recordings',
    tabSettings: 'Settings',

    // Home/Recording
    tapToRecord: 'Tap to Record',
    recording: 'Recording',
    tapToStop: 'Tap to Stop',
    recentRecordings: 'Recent Recordings',
    viewAll: 'View All',
    noRecordings: 'No Recordings Yet',
    noRecordingsMessage: 'Tap the big button above to start your first recording',

    // Processing
    processing: 'Processing',
    saving: 'Saving',
    uploadingAudio: 'Uploading audio...',
    takingNotes: 'Taking notes...',
    findingKeyPoints: 'Finding key points...',
    mayTakeFewMinutes: 'This may take a few minutes',
    processingComplete: 'Processing Complete',

    // Recording Detail
    summary: 'Summary',
    notes: 'Notes',
    summaryHeader: 'Summary',
    notesHeader: 'Notes',
    tapNotesForMore: 'Tap "Notes" for more details',
    speaker: 'Speaker',
    addLabel: 'Tap to add label',
    edit: 'Edit',
    share: 'Share',
    delete: 'Delete',
    regenerate: 'Regenerate',
    transcribe: 'Transcribe',
    summarize: 'Summarize',
    recordingSaved: 'Recording saved. Tap below to transcribe',
    transcribePromptTitle: 'Start Transcription',
    transcribePromptMessage: 'This will use approximately {minutes} minutes of AI processing.',
    summarizePromptTitle: 'Start Summarization',
    summarizePromptMessage: 'Generate summary from transcript. Summarization is free.',
    noSummaryYet: 'No summary yet. Tap "Summarize" below to generate.',
    aiMinutesRemaining: 'Remaining: {remaining} minutes',
    unlimited: 'Unlimited',

    // Playback
    play: 'Play',
    pause: 'Pause',
    normalSpeed: 'Normal',
    slowSpeed: 'Slower',
    tapLineToHear: 'Tap any line to hear that part',

    // Library
    myRecordings: 'My Recordings',
    search: 'Search',
    searchPlaceholder: 'Search recordings...',
    notesReady: 'Notes Ready',
    summaryReady: 'Summary',
    processingStatus: 'Processing',

    // Sharing
    shareWithFamily: 'Share with Family',
    shareSummary: 'Share Summary',
    shareNotes: 'Share Notes',
    shareAudio: 'Share Audio',
    downloadAudio: 'Download Audio',
    convertingAudio: 'Converting...',
    copyText: 'Copy Text',
    copied: 'Copied',
    noSummaryToShare: 'No summary to share',
    noNotesToShare: 'No notes to share',
    failedToCopy: 'Failed to copy',
    audioSharingNotAvailableWeb: 'Audio sharing is not available on web. Please use the mobile app.',
    sharingNotAvailable: 'Sharing not available',
    failedToShareAudio: 'Failed to share audio',

    // Settings
    settings: 'Settings',
    language: 'Language',
    textSize: 'Text Size',
    textSizeSmall: 'Small',
    textSizeMedium: 'Medium',
    textSizeLarge: 'Large',
    help: 'Help',
    about: 'About',
    aboutWiseKeep: 'About WiseKeep',
    version: 'Version',

    // Confirmations & Alerts
    confirmDelete: 'Are you sure?',
    confirmDeleteMessage: 'This recording will be permanently deleted and cannot be recovered.',
    cancel: 'Cancel',
    confirm: 'Confirm',

    // Phone call interruption
    incomingCall: 'Answer Call?',
    answerAndStop: 'Answer & Stop Recording',
    declineAndContinue: 'Decline & Keep Recording',

    // Offline/Errors
    noInternet: 'No Internet Connection',
    noInternetMessage: 'Your recording is saved safely and will process when connected.',
    willProcessWhenConnected: 'Will process when connected',
    lastRecordingSaved: 'Your last recording was saved',
    error: 'Something went wrong',
    tryAgain: 'Try Again',
    storageFull: 'Storage Full',
    storageFullMessage: 'Please delete some old recordings to continue recording new ones.',

    // First recording education
    recordingReady: 'Your recording is ready!',
    notesExplanation: 'We noted down the conversation for you',
    summaryExplanation: 'The most important points',
    viewRecording: 'View Recording',

    // Time formatting
    today: 'Today',
    yesterday: 'Yesterday',
    daysAgo: 'days ago',

    // Duration
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'seconds',

    // Payments
    upgradeToPremium: 'Upgrade to Unlimited',
    restorePurchases: 'Restore Purchases',
    unlimitedRecordings: 'Unlimited Recording Time',
    purchaseRestored: 'Purchase Restored',
    noPurchasesToRestore: 'No purchases to restore',
    purchaseFailed: 'Purchase failed, please try again',

    // Support
    supportCode: 'Support Code',
    codeCopied: 'Code copied',
  },
};
