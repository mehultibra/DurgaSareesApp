package com.durgasarees.catalog;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DurgaCallNotificationListener extends NotificationListenerService {
    private static volatile long sLastProcessedTime = 0;
    private static volatile String sLastProcessedKey = "";
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?:\\+91|91|0)?[6-9]\\d{9}");

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            String pkg = sbn.getPackageName();
            if (pkg == null) return;

            // Only phone dialer / in-call UI packages
            if (!pkg.equals("com.samsung.android.incallui") &&
                !pkg.equals("com.android.incallui") &&
                !pkg.equals("com.google.android.dialer") &&
                !pkg.equals("com.samsung.android.dialer") &&
                !pkg.equals("com.android.server.telecom")) {
                return;
            }

            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;

            Bundle extras = n.extras;
            CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textCs = extras.getCharSequence(Notification.EXTRA_TEXT);

            String title = titleCs != null ? titleCs.toString().trim() : "";
            String text = textCs != null ? textCs.toString().trim() : "";
            if (title.isEmpty() && text.isEmpty()) return;

            // Check if title or text contains a 10-digit phone number
            String combined = title + " " + text;
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
                partyName = lookupNameByPhone(p10);
            } else if (!title.isEmpty()) {
                // If title has contact name, lookup phone number from device contacts
                partyName = title;
                p10 = lookupPhoneByName(title);
            }

            if (p10 == null && partyName == null) return;

            String dedupeKey = (p10 != null ? p10 : "") + "|" + (partyName != null ? partyName : "");
            long now = System.currentTimeMillis();
            if (dedupeKey.equals(sLastProcessedKey) && (now - sLastProcessedTime < 60000)) {
                return; // Debounce within 60 seconds
            }
            sLastProcessedKey = dedupeKey;
            sLastProcessedTime = now;

            String effectivePhone = p10 != null ? p10 : "";
            String effectiveName = partyName != null ? partyName : "";

            SharedPreferences sp = getSharedPreferences("ds_call_prefs", Context.MODE_PRIVATE);
            sp.edit()
                .putString("last_call_phone", effectivePhone)
                .putString("last_call_name", effectiveName)
                .putString("last_call_dir", "active")
                .putLong("last_call_time", now)
                .apply();

            CallMonitorPlugin.notifyLiveCall(this, !effectivePhone.isEmpty() ? effectivePhone : effectiveName, "active");
            DurgaCallScreeningService.showCallNotification(this, effectivePhone, effectiveName, "active");
        } catch (Throwable ignored) {}
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
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ ContactsContract.CommonDataKinds.Phone.NUMBER },
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " = ?",
                new String[]{ name },
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
        } catch (Throwable ignored) {
        } finally {
            if (cursor != null) {
                try { cursor.close(); } catch (Throwable ignored) {}
            }
        }
        return null;
    }
}

