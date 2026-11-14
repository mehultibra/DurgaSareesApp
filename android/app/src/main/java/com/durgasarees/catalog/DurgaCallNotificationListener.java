package com.durgasarees.catalog;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DurgaCallNotificationListener extends NotificationListenerService {
    private static volatile DurgaCallNotificationListener sInstance = null;
    private static volatile long sLastProcessedTime = 0;
    private static volatile String sLastProcessedKey = "";
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?:\\+?91[\\s\\-]*)?0?[6-9](?:[\\s\\-]*\\d){9}");

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        sInstance = this;
    }

    @Override
    public void onDestroy() {
        if (sInstance == this) sInstance = null;
        super.onDestroy();
    }

    public static boolean isDialerPkg(String pkg) {
        if (pkg == null) return false;
        return pkg.equals("com.samsung.android.incallui") ||
            pkg.equals("com.samsung.android.dialer") ||
            pkg.equals("com.samsung.android.app.telephonyui") ||
            pkg.equals("com.android.phone") ||
            pkg.equals("com.google.android.dialer") ||
            pkg.equals("com.android.incallui") ||
            pkg.equals("com.android.dialer") ||
            pkg.equals("com.android.server.telecom") ||
            pkg.contains("incall") ||
            pkg.contains("dialer") ||
            pkg.contains("telephony");
    }

    public static void scanActiveNotificationsNow(Context context) {
        try {
            if (context != null) {
                AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                int mode = am != null ? am.getMode() : AudioManager.MODE_NORMAL;
                boolean inCall = (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION || mode == AudioManager.MODE_RINGTONE);
                if (!inCall) {
                    sLastProcessedKey = "";
                    sLastProcessedTime = 0;
                    CallMonitorPlugin.notifyCallDisconnected(context);
                    DurgaCallScreeningService.dismissCallNotification(context);
                    return;
                }
            }
            DurgaCallNotificationListener listener = sInstance;
            if (listener == null) return;
            StatusBarNotification[] active = listener.getActiveNotifications();
            if (active != null) {
                for (StatusBarNotification sbn : active) {
                    if (sbn != null && isDialerPkg(sbn.getPackageName())) {
                        listener.processNotification(sbn);
                    }
                }
            }
        } catch (Throwable ignored) {}
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        sInstance = this;
        processNotification(sbn);
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        super.onNotificationRemoved(sbn);
        try {
            if (sbn == null) return;
            String pkg = sbn.getPackageName();
            if (!isDialerPkg(pkg)) return;

            boolean hasDialer = false;
            try {
                StatusBarNotification[] active = getActiveNotifications();
                if (active != null) {
                    for (StatusBarNotification a : active) {
                        if (a != null && isDialerPkg(a.getPackageName())) {
                            hasDialer = true;
                            break;
                        }
                    }
                }
            } catch (Throwable ignored) {}

            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int mode = am != null ? am.getMode() : AudioManager.MODE_NORMAL;
            boolean inCall = (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION);

            if (!hasDialer || !inCall) {
                sLastProcessedKey = "";
                sLastProcessedTime = 0;
                CallMonitorPlugin.notifyCallDisconnected(this);
                DurgaCallScreeningService.dismissCallNotification(this);
            }
        } catch (Throwable ignored) {}
    }

    private void processNotification(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            String pkg = sbn.getPackageName();
            if (!isDialerPkg(pkg)) {
                return;
            }

            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            if (!sp.getBoolean("call_popup_enabled", true)) {
                return;
            }

            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int mode = am != null ? am.getMode() : AudioManager.MODE_NORMAL;
            boolean inCall = (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION || mode == AudioManager.MODE_RINGTONE);
            if (!inCall) return;

            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;

            Bundle extras = n.extras;
            CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence subCs = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
            CharSequence bigTitleCs = extras.getCharSequence(Notification.EXTRA_TITLE_BIG);
            CharSequence bigTextCs = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

            String title = titleCs != null ? titleCs.toString().trim() : "";
            String text = textCs != null ? textCs.toString().trim() : "";
            String sub = subCs != null ? subCs.toString().trim() : "";
            String bigTitle = bigTitleCs != null ? bigTitleCs.toString().trim() : "";
            String bigText = bigTextCs != null ? bigTextCs.toString().trim() : "";
            if (title.isEmpty() && text.isEmpty() && sub.isEmpty()) return;

            // Check if title, text, or subtext contains a 10-digit phone number
            String combined = title + " " + text + " " + sub + " " + bigTitle + " " + bigText;
            String lowerCombined = combined.toLowerCase();
            if (lowerCombined.contains("missed") || lowerCombined.contains("record") || lowerCombined.contains("saving") || lowerCombined.contains("saved")) return;
            String p10 = null;
            Matcher m = PHONE_PATTERN.matcher(combined);
            if (m.find()) {
                String matchStr = m.group().replaceAll("\\D", "");
                if (matchStr.length() >= 10) {
                    p10 = matchStr.substring(matchStr.length() - 10);
                }
            }

            String partyName = null;
            if (p10 != null) {
                if (!isGenericDialerStatus(title)) {
                    partyName = title;
                } else if (!isGenericDialerStatus(bigTitle)) {
                    partyName = bigTitle;
                } else if (!isGenericDialerStatus(text)) {
                    partyName = text;
                } else if (!isGenericDialerStatus(bigText)) {
                    partyName = bigText;
                } else if (!isGenericDialerStatus(sub)) {
                    partyName = sub;
                } else {
                    partyName = lookupNameByPhone(p10);
                }
            } else {
                // If no phone in notification text, check title, bigTitle, text, bigText, sub against contacts
                if (!isGenericDialerStatus(title)) {
                    p10 = lookupPhoneByName(title);
                    if (p10 != null) partyName = title;
                }
                if (p10 == null && !isGenericDialerStatus(bigTitle)) {
                    p10 = lookupPhoneByName(bigTitle);
                    if (p10 != null) partyName = bigTitle;
                }
                if (p10 == null && !isGenericDialerStatus(text)) {
                    p10 = lookupPhoneByName(text);
                    if (p10 != null) partyName = text;
                }
                if (p10 == null && !isGenericDialerStatus(bigText)) {
                    p10 = lookupPhoneByName(bigText);
                    if (p10 != null) partyName = bigText;
                }
                if (p10 == null && !isGenericDialerStatus(sub)) {
                    p10 = lookupPhoneByName(sub);
                    if (p10 != null) partyName = sub;
                }
            }

            // CRITICAL: Even if p10 is null (for example, if the contact was not synced to device phonebook yet,
            // or READ_CONTACTS wasn't granted yet, but title/text is a non-generic caller name like "RADHIKA SAREES [SURAT]"),
            // if !isGenericDialerStatus and title/text contains [ or length >= 4, do NOT abort!
            // Pass p10 = "" and partyName = candidateName to CallMonitorPlugin.notifyLiveCall and showCallNotification!
            if (p10 == null || p10.length() != 10) {
                String candidateName = "";
                if (!isGenericDialerStatus(title)) {
                    candidateName = title;
                } else if (!isGenericDialerStatus(bigTitle)) {
                    candidateName = bigTitle;
                } else if (!isGenericDialerStatus(text)) {
                    candidateName = text;
                } else if (!isGenericDialerStatus(bigText)) {
                    candidateName = bigText;
                } else if (!isGenericDialerStatus(sub)) {
                    candidateName = sub;
                }

                if (!candidateName.isEmpty() && (candidateName.contains("[") || candidateName.length() >= 4)) {
                    p10 = "";
                    partyName = candidateName;
                } else {
                    return;
                }
            }

            if (partyName == null || isGenericDialerStatus(partyName)) {
                if (p10 != null && !p10.isEmpty()) {
                    partyName = lookupNameByPhone(p10);
                }
            }
            if (partyName == null || partyName.trim().isEmpty()) {
                partyName = p10;
            }

            // Strict check: Only show notification/popup for numbers matching accounts in our app
            if (!DurgaCallScreeningService.isDurgaSareesAccount(this, p10, partyName)) {
                return;
            }

            String dedupeKey = (p10.isEmpty() ? partyName : p10) + "|" + partyName;
            long now = System.currentTimeMillis();
            if (dedupeKey.equals(sLastProcessedKey) && (now - sLastProcessedTime < 60000)) {
                return; // Debounce within 60 seconds
            }
            sLastProcessedKey = dedupeKey;
            sLastProcessedTime = now;

            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit()
                .putString("last_call_phone", p10)
                .putString("last_call_name", partyName)
                .putString("last_call_dir", "active")
                .putLong("last_call_time", now)
                .apply();

            CallMonitorPlugin.notifyLiveCall(this, p10, partyName, "active");
            DurgaCallScreeningService.showCallNotification(this, p10, partyName, "active");
        } catch (Throwable ignored) {}
    }

    private boolean isGenericDialerStatus(String s) {
        if (s == null) return true;
        String lower = s.trim().toLowerCase();
        if (lower.isEmpty()) return true;
        if (lower.matches("^\\d{1,2}:\\d{2}(?::\\d{2})?$")) return true;
        if (lower.contains("record") || lower.contains("saving") || lower.contains("saved") || lower.contains("audio")) return true;
        return lower.contains("ongoing call") ||
               lower.contains("incoming call") ||
               lower.contains("active call") ||
               lower.contains("call in progress") ||
               lower.contains("return to call") ||
               lower.contains("tap to return") ||
               lower.contains("dialing") ||
               lower.contains("calling") ||
               lower.contains("ringing") ||
               lower.contains("connecting") ||
               lower.contains("call ended") ||
               lower.contains("missed call") ||
               lower.contains("sim 1") ||
               lower.contains("sim 2") ||
               lower.contains("hd+") ||
               lower.contains("hd") ||
               lower.contains("volte") ||
               lower.contains("wi-fi call") ||
               lower.contains("wifi call") ||
               lower.contains("speaker") ||
               lower.contains("muted");
    }

    private String lookupNameByPhone(String p10) {
        Cursor cursor = null;
        try {
            Uri uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(p10));
            cursor = getContentResolver().query(uri, new String[]{ ContactsContract.PhoneLookup.DISPLAY_NAME }, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME);
                if (idx >= 0) return cursor.getString(idx);
            }
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) {
                try { cursor.close(); } catch (Throwable ignored) {}
            }
        }
        return null;
    }

    private String lookupPhoneByName(String name) {
        if (name == null || name.trim().isEmpty()) return null;
        String trimmed = name.trim();
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER },
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " = ?",
                new String[]{ trimmed },
                null
            );
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                if (idx >= 0) {
                    String num = cursor.getString(idx);
                    if (num != null) {
                        String digits = num.replaceAll("\\D", "");
                        if (digits.length() >= 10) {
                            return digits.substring(digits.length() - 10);
                        }
                    }
                }
            }
            if (cursor != null) {
                cursor.close();
                cursor = null;
            }

            // Fallback: strip [CITY] if present and query DISPLAY_NAME LIKE baseName%
            String baseName = trimmed;
            int bracketIdx = baseName.indexOf('[');
            if (bracketIdx > 0) {
                baseName = baseName.substring(0, bracketIdx).trim();
            }
            if (baseName.length() >= 4) {
                cursor = getContentResolver().query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER },
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " LIKE ?",
                    new String[]{ baseName + "%" },
                    null
                );
                if (cursor != null && cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    if (idx >= 0) {
                        String num = cursor.getString(idx);
                        if (num != null) {
                            String digits = num.replaceAll("\\D", "");
                            if (digits.length() >= 10) {
                                return digits.substring(digits.length() - 10);
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) {
                try { cursor.close(); } catch (Throwable ignored) {}
            }
        }
        return null;
    }
}

